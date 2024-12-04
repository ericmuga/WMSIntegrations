import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

// Function to load and parse the Excel file
const readExcelFile = (filePath) => {
    try {
        const workbook = xlsx.readFile(filePath); // Read the Excel file
        const sheetName = workbook.SheetNames[0]; // Use the first sheet
        const sheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(sheet); // Convert sheet to JSON

        if (!Array.isArray(jsonData)) {
            throw new Error("Parsed sheet data is not an array");
        }
        return jsonData;
    } catch (error) {
        console.error("Error reading Excel file:", error.message);
        return []; // Return an empty array to avoid crashes
    }
};

// Example Usage
const filePath = 'ChoppingOnly.xlsx';
const sheetData = readExcelFile(filePath);


// Load the JSON lookup table
// const lookupFilePath = path.resolve('./Services/Transformers/choppingLocations.json');
// const lookupTable = JSON.parse(fs.readFileSync(lookupFilePath, 'utf-8'));

// Functions to resolve LocationCode and UOM
const resolveLocationCode = (itemCode, process, sheetData) => {
    for (const row of sheetData) {
        if (row.Process === process) {
            if (row["Input Item"] === itemCode) {
                return row["Input Location code"]; // Resolve for input item
            }
            if (row["Output Item Code"] === itemCode) {
                return row["Output Location code"]; // Resolve for output item
            }
        }
    }
    return "2055"; // Default location if item not found
};

const resolveUnitOfMeasure = (itemCode, process, sheetData) => {
    for (const row of sheetData) {
        if (row.Process === process) {
            if (row["Input Item"] === itemCode) {
                return row["input_uom"]; // Resolve for input item
            }
            if (row["Output Item Code"] === itemCode) {
                return row["output_uom"]; // Resolve for output item
            }
        }
    }
    return "KG"; // Default UOM if item not found
};

// Transform function
export const transformData = (responseData) => {
    const filePath = 'ChoppingOnly.xlsx';
    const sheetData = readExcelFile(filePath);

    // Validate sheetData
    if (!Array.isArray(sheetData) || sheetData.length === 0) {
        throw new Error("Invalid or empty sheetData provided.");
    }

    // Convert the input object to an array of items
    const itemsArray = Object.values(responseData).filter(
        item => item && item.id && item.chopping_id && item.item_code
    );

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
        const outputItem = items.find(item => item.output === "1" || item.output === 1);
        const consumptionItems = items.filter(item => item.output === "0" || item.output === 0);

        if (!outputItem) {
            console.error("Group Items:", items);
            throw new Error("No output entry found in the data");
        }

        const resolveItemDetails = (itemCode) => {
            return {
                location: resolveLocationCode(itemCode, "Chopping", sheetData),
                uom: resolveUnitOfMeasure(itemCode, "Chopping", sheetData)
            };
        };

        // Handle special items (e.g., G8900, G8901)
        const specialItems = ['G8900', 'G8901'];
        const specialConsumptionLines = [];

        specialItems.forEach(specialItemCode => {
            const specialConsumptionItem = consumptionItems.find(item => item.item_code === specialItemCode);
            if (specialConsumptionItem) {
                const specialDetails = resolveItemDetails(specialItemCode);

                const specialOrderNumber = `WP_${Date.now()}`;
                const specialProductionOrder = {
                    production_order_no: specialOrderNumber,
                    ItemNo: specialConsumptionItem.item_code,
                    Quantity: parseFloat(specialConsumptionItem.weight),
                    uom: specialDetails.uom,
                    LocationCode: specialDetails.location,
                    BIN: "",
                    user: "DefaultUser",
                    line_no: 1000,
                    routing: "production_data_order_chopping.bc",
                    date_time: dateTime,
                    ProductionJournalLines: [
                        {
                            ItemNo: specialConsumptionItem.item_code,
                            Quantity: parseFloat(specialConsumptionItem.weight),
                            uom: specialDetails.uom,
                            LocationCode: specialDetails.location,
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
                    uom: specialDetails.uom,
                    LocationCode: specialDetails.location,
                    BIN: "",
                    type: "consumption",
                    date_time: dateTime,
                    user: "DefaultUser"
                });
            }
        });

        const outputDetails = resolveItemDetails(outputItem.item_code);

        // Build the main production order
        const mainProductionOrder = {
            production_order_no: `${outputItem.chopping_id}_${outputItem.id}`,
            ItemNo: outputItem.item_code,
            Quantity: parseFloat(outputItem.weight),
            uom: outputDetails.uom,
            LocationCode: outputDetails.location,
            BIN: "",
            user: "DefaultUser",
            line_no: 1000,
            routing: "production_data_chopping.bc",
            date_time: dateTime,
            ProductionJournalLines: []
        };

        const seenItems = new Set();
        const seenLineNumbers = new Set();

        // Add the output line
        mainProductionOrder.ProductionJournalLines.push({
            ItemNo: outputItem.item_code,
            Quantity: parseFloat(outputItem.weight),
            uom: outputDetails.uom,
            LocationCode: outputDetails.location,
            BIN: "",
            line_no: 1000,
            type: "output",
            date_time: dateTime,
            user: "DefaultUser"
        });
        seenItems.add(outputItem.item_code);
        seenLineNumbers.add(1000);

        // Add consumption lines
        [...consumptionItems, ...specialConsumptionLines].forEach((item, index) => {
            const lineNumber = 2000 + index * 1000;

            const itemDetails = resolveItemDetails(item.item_code);

            if (!seenItems.has(item.item_code) && !seenLineNumbers.has(lineNumber)) {
                mainProductionOrder.ProductionJournalLines.push({
                    ItemNo: item.item_code,
                    Quantity: parseFloat(item.weight),
                    uom: itemDetails.uom,
                    LocationCode: itemDetails.location,
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







// Example usage
// const jsonData = {
//     "0":{
//        "id":"338275",
//        "chopping_id":"1230K56-51",
//        "item_code":"G2011",
//        "weight":"50.00",
//        "output":"0",
//        "batch_no":null,
//        "created_at":"2024-12-03 14:26:14.307",
//        "updated_at":"2024-12-03 14:26:14.307",
//        "timestamp":"2024-12-03 14:26:52"
//     },
//     "1":{
//        "id":"338277",
//        "chopping_id":"1230K56-51",
//        "item_code":"G2005",
//        "weight":"10.30",
//        "output":"0",
//        "batch_no":null,
//        "created_at":"2024-12-03 14:26:22.723",
//        "updated_at":"2024-12-03 14:26:22.723",
//        "timestamp":"2024-12-03 14:26:52"
//     },
//     "2":{
//        "id":"338278",
//        "chopping_id":"1230K56-51",
//        "item_code":"G8901",
//        "weight":"20.10",
//        "output":"0",
//        "batch_no":null,
//        "created_at":"2024-12-03 14:26:34.350",
//        "updated_at":"2024-12-03 14:26:34.350",
//        "timestamp":"2024-12-03 14:26:52"
//     },
//     "3":{
//        "id":"338279",
//        "chopping_id":"1230K56-51",
//        "item_code":"G2001",
//        "weight":"10.20",
//        "output":"0",
//        "batch_no":null,
//        "created_at":"2024-12-03 14:26:42.583",
//        "updated_at":"2024-12-03 14:26:42.583",
//        "timestamp":"2024-12-03 14:26:52"
//     },
//     "4":{
//        "id":"338281",
//        "chopping_id":"1230K56-51",
//        "item_code":"G2159",
//        "weight":"30.20",
//        "output":"0",
//        "batch_no":null,
//        "created_at":"2024-12-03 14:26:49.543",
//        "updated_at":"2024-12-03 14:26:49.543",
//        "timestamp":"2024-12-03 14:26:52"
//     },
//     "5":{
//        "id":"338282",
//        "chopping_id":"1230K56-51",
//        "item_code":"G2109",
//        "weight":".14",
//        "output":"0",
//        "batch_no":null,
//        "created_at":"2024-12-03 14:26:52.723",
//        "updated_at":"2024-12-03 14:26:52.723",
//        "timestamp":"2024-12-03 14:26:52"
//     },
//     "6":{
//        "id":"338283",
//        "chopping_id":"1230K56-51",
//        "item_code":"G2126",
//        "weight":"3.00",
//        "output":"0",
//        "batch_no":null,
//        "created_at":"2024-12-03 14:26:52.723",
//        "updated_at":"2024-12-03 14:26:52.723",
//        "timestamp":"2024-12-03 14:26:52"
//     },
//     "7":{
//        "id":"338284",
//        "chopping_id":"1230K56-51",
//        "item_code":"H133003",
//        "weight":".32",
//        "output":"0",
//        "batch_no":null,
//        "created_at":"2024-12-03 14:26:52.723",
//        "updated_at":"2024-12-03 14:26:52.723",
//        "timestamp":"2024-12-03 14:26:52"
//     },
//     "8":{
//        "id":"338285",
//        "chopping_id":"1230K56-51",
//        "item_code":"H133014",
//        "weight":".32",
//        "output":"0",
//        "batch_no":null,
//        "created_at":"2024-12-03 14:26:52.723",
//        "updated_at":"2024-12-03 14:26:52.723",
//        "timestamp":"2024-12-03 14:26:52"
//     },
//     "9":{
//        "id":"338286",
//        "chopping_id":"1230K56-51",
//        "item_code":"H133019",
//        "weight":"4.00",
//        "output":"0",
//        "batch_no":null,
//        "created_at":"2024-12-03 14:26:52.723",
//        "updated_at":"2024-12-03 14:26:52.723",
//        "timestamp":"2024-12-03 14:26:52"
//     },
//     "10":{
//        "id":"338287",
//        "chopping_id":"1230K56-51",
//        "item_code":"H133023",
//        "weight":"6.00",
//        "output":"0",
//        "batch_no":null,
//        "created_at":"2024-12-03 14:26:52.723",
//        "updated_at":"2024-12-03 14:26:52.723",
//        "timestamp":"2024-12-03 14:26:52"
//     },
//     "11":{
//        "id":"338288",
//        "chopping_id":"1230K56-51",
//        "item_code":"H231025",
//        "weight":"14.00",
//        "output":"0",
//        "batch_no":null,
//        "created_at":"2024-12-03 14:26:52.723",
//        "updated_at":"2024-12-03 14:26:52.723",
//        "timestamp":"2024-12-03 14:26:52"
//     },
//     "12":{
//        "id":"338289",
//        "chopping_id":"1230K56-51",
//        "item_code":"G2208",
//        "weight":"148.58",
//        "output":"1",
//        "batch_no":null,
//        "created_at":"2024-12-03 14:26:52.783",
//        "updated_at":"2024-12-03 14:26:52.783",
//        "timestamp":"2024-12-03 14:26:52"
//     },
//     "company_name":"FCL"
//  }

// try {
//     const productionOrders = transformData(jsonData);
//     console.log("Transformed Production Orders:", JSON.stringify(productionOrders, null, 2));
// } catch (error) {
//     console.error("Error:", error.message);
// }
