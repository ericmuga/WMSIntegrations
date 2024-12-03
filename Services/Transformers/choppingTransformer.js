import fs from 'fs';
import path from 'path';

const lookup = {
    // process_key: 'P20',
    process_key: ''
};





// Load the JSON file generated from the Excel
const lookupFilePath = path.resolve('./Services/Transformers/choppingLocations.json');
const lookupTable = JSON.parse(fs.readFileSync(lookupFilePath, 'utf-8'));

const resolveLocationCode = (itemCode, lookupTable) => {
    for (const locationCode in lookupTable) {
        const items = lookupTable[locationCode];
        if (items.some(item => item.item_no === itemCode)) {
            return locationCode; // Return the location code if item is found
        }
    }
    return "DefaultLocation"; // Default location if item not found
};


const resolveUnitOfMeasure = (itemCode, lookupTable) => {
    for (const locationCode in lookupTable) {
        const item = lookupTable[locationCode].find(item => item.item_no === itemCode);
        if (item) {
            return item.uom; // Return the UOM if item is found
        }
    }
    return "PCS"; // Default UOM if item not found
};


export const transformData = (responseData) => {
    const itemsArray = Array.isArray(responseData) ? responseData : [responseData];

    const groupedItems = itemsArray.reduce((acc, item) => {
        const key = item.chopping_id || 'default';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    const productionOrders = [];

    for (const groupKey in groupedItems) {
        const items = groupedItems[groupKey];
        const dateTime = new Date(items[0]?.timestamp || Date.now()).toISOString();
        const outputItem = items.find(item => item.output === "1");
        const consumptionItems = items.filter(item => item.output === "0");

        if (!outputItem) throw new Error("No output entry found in the data");

        const findItemDetails = (itemCode) => {
            for (const location in lookupTable) {
                const itemDetails = lookupTable[location].find(item => item.item_no === itemCode);
                if (itemDetails) return { location, uom: itemDetails.uom };
            }
            return null;
        };

        // Handle special items (G8900, G8901)
        const specialItems = ['G8900', 'G8901'];
        const specialConsumptionLines = []; // To track consumption lines for the main order

        specialItems.forEach(specialItemCode => {
            const specialConsumptionItem = consumptionItems.find(item => item.item_code === specialItemCode);
            if (specialConsumptionItem) {
                const specialDetails = findItemDetails(specialItemCode) || {};
                const { location: specialLocation = "2055", uom: specialUom = "KG" } = specialDetails;

                const specialOrderNumber = `WP_${Date.now()}`;
                const specialProductionOrder = {
                    production_order_no: specialOrderNumber,
                    ItemNo: specialConsumptionItem.item_code,
                    Quantity: parseFloat(specialConsumptionItem.weight),
                    uom: resolveUnitOfMeasure(specialConsumptionItem.item_code, lookupTable),
                    LocationCode: resolveLocationCode(specialConsumptionItem.item_code, lookupTable),
                    BIN: "",
                    user: "USER",
                    line_no: 1000,
                    routing: "production_data_chopping_beheading.bc",
                    date_time: dateTime,
                    ProductionJournalLines: [
                        {
                            ItemNo: specialConsumptionItem.item_code,
                            Quantity: parseFloat(specialConsumptionItem.weight),
                            uom: resolveUnitOfMeasure(specialConsumptionItem.item_code, lookupTable),
                            LocationCode: resolveLocationCode(specialConsumptionItem.item_code, lookupTable),
                            BIN: "",
                            line_no: 1000,
                            type: "output",
                            date_time: dateTime,
                            user: "DefaultUser"
                        }
                    ]
                };

                // Add the special production order
                productionOrders.push(specialProductionOrder);

                // Track the consumption line for the main production order
                specialConsumptionLines.push({
                    item_code: specialConsumptionItem.item_code,
                    weight: specialConsumptionItem.weight,
                    uom: resolveUnitOfMeasure(specialConsumptionItem.item_code, lookupTable),
                    LocationCode: resolveLocationCode(specialConsumptionItem.item_code, lookupTable),
                    BIN: "",
                    type: "consumption",
                    date_time: dateTime,
                    user: "DefaultUser"
                });
            }
        });

        const outputDetails = findItemDetails(outputItem.item_code);
        if (!outputDetails) throw new Error(`Details for ItemNo ${outputItem.item_code} not found in lookup`);

        const { location: outputLocation, uom: outputUom } = outputDetails;

        // Build the main production order
        const mainProductionOrder = {
            production_order_no: `${outputItem.chopping_id}_${outputItem.id}`,
            ItemNo: outputItem.item_code,
            Quantity: parseFloat(outputItem.weight),
            uom: resolveUnitOfMeasure(outputItem.item_code, lookupTable),
            LocationCode: resolveLocationCode(outputItem.item_code, lookupTable),
            BIN: "",
            user: "DefaultUser",
            line_no: 1000,
            routing: "production_data_chopping_beheading.bc",
            date_time: dateTime,
            ProductionJournalLines: []
        };

        const seenItems = new Set();
        const seenLineNumbers = new Set();

        // Add the output line
        mainProductionOrder.ProductionJournalLines.push({
            ItemNo: outputItem.item_code,
            Quantity: parseFloat(outputItem.weight),
            uom: resolveUnitOfMeasure(outputItem.item_code, lookupTable),
            LocationCode: resolveLocationCode(outputItem.item_code, lookupTable),
            BIN: "",
            line_no: 1000,
            type: "output",
            date_time: dateTime,
            user: "DefaultUser"
        });
        seenItems.add(outputItem.item_code);
        seenLineNumbers.add(1000);

        // Add consumption lines with validation
        [...consumptionItems, ...specialConsumptionLines].forEach((item, index) => {
            const lineNumber = 2000 + index * 1000;
            if (!seenItems.has(item.item_code) && !seenLineNumbers.has(lineNumber)) {
                mainProductionOrder.ProductionJournalLines.push({
                    ItemNo: item.item_code,
                    Quantity: parseFloat(item.weight),
                    uom: resolveUnitOfMeasure(item.item_code, lookupTable) ,
                    LocationCode: resolveLocationCode(item.item_code, lookupTable) ,
                    BIN: item.BIN || "",
                    line_no: lineNumber,
                    type: item.type || "consumption",
                    date_time: item.date_time || dateTime,
                    user: item.user || "DefaultUser"
                });
                seenItems.add(item.item_code);
                seenLineNumbers.add(lineNumber);
            }
        });

        productionOrders.push(mainProductionOrder);
    }

    return productionOrders;
};


