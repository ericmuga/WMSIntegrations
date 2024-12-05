import fs from 'fs';
import xlsx from 'xlsx';

// Function to load and parse the Excel file
const readExcelFile = (filePath) => {
    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(sheet);

        if (!Array.isArray(jsonData)) {
            throw new Error("Parsed sheet data is not an array");
        }
        return jsonData;
    } catch (error) {
        console.error("Error reading Excel file:", error.message);
        return [];
    }
};

const roundTo4Decimals = (value) => {
    if (isNaN(value) || value === null || value === undefined) {
        throw new Error(`Invalid number: ${value}`);
    }
    return parseFloat(Number(value).toFixed(4));
};

// Replacement mapping
const replaceItems = {
    "G2011": "G2009",
    "G2016": "G2009",
    "G2045": "G2044",
    "G2161": "G2159",
    "G2013": "G2005",
    "G2155":"G2007"
};

// Replace item if needed
const replaceItemIfNeeded = (itemNo) => replaceItems[itemNo] || itemNo;

// Create a special production order
const createSpecialProductionOrder = (specialItem, dateTime, context) => {
    return {
        production_order_no: `WP_${specialItem.ItemNo}_${context}_${Date.now()}`,
        ItemNo: specialItem.ItemNo,
        Quantity: roundTo4Decimals(specialItem.Quantity),
        uom: specialItem.uom,
        LocationCode: specialItem.LocationCode,
        BIN: "",
        user: "DefaultUser",
        line_no: 1000,
        routing: "special_spice_production.bc",
        date_time: dateTime,
        ProductionJournalLines: [
            {
                ItemNo: specialItem.ItemNo,
                Quantity: roundTo4Decimals(specialItem.Quantity),
                uom: specialItem.uom,
                LocationCode: specialItem.LocationCode,
                BIN: "",
                line_no: 1000,
                type: "output",
                date_time: dateTime,
                user: "DefaultUser"
            }
        ]
    };
};

export const transformData = (responseData) => {
    const filePath = 'ChoppingOnly.xlsx';
    const sheetData = readExcelFile(filePath);

    const spicePremixFilePath = 'SpicePremix.xlsx';
    const spicePremixData = readExcelFile(spicePremixFilePath);

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
    const specialItems = ["G8900", "G8901"];

    for (const groupKey in groupedItems) {
        const items = groupedItems[groupKey];
        const dateTime = new Date(items[0]?.timestamp || Date.now()).toISOString();
        const outputItem = items.find(item => item.output === "1" || item.output === 1);
        const consumptionItems = items.filter(item => item.output === "0" || item.output === 0);

        if (!outputItem) {
            throw new Error("No output entry found in the data");
        }

        const resolveItemDetails = (itemCode) => {
            return {
                location: "2055", // Default location (for simplicity)
                uom: "KG" // Default UOM
            };
        };

        const outputDetails = resolveItemDetails(outputItem.item_code);

        const mainProductionOrder = {
            production_order_no: `${outputItem.chopping_id}_${outputItem.id}`,
            ItemNo: replaceItemIfNeeded(outputItem.item_code),
            Quantity: roundTo4Decimals(outputItem.weight),
            uom: outputDetails.uom,
            LocationCode: outputDetails.location,
            BIN: "",
            user: "DefaultUser",
            line_no: 1000,
            routing: "production_data_chopping_beheading.bc",
            date_time: dateTime,
            ProductionJournalLines: []
        };

        // Add output line
        mainProductionOrder.ProductionJournalLines.push({
            ItemNo: replaceItemIfNeeded(outputItem.item_code),
            Quantity: roundTo4Decimals(outputItem.weight),
            uom: outputDetails.uom,
            LocationCode: outputDetails.location,
            BIN: "",
            line_no: 1000,
            type: "output",
            date_time: dateTime,
            user: "DefaultUser"
        });

        // Add consumption lines
        consumptionItems.forEach((item, index) => {
            const replacedItemCode = replaceItemIfNeeded(item.item_code);
            const lineNumber = 2000 + index * 1000;
            const itemDetails = resolveItemDetails(replacedItemCode);

            mainProductionOrder.ProductionJournalLines.push({
                ItemNo: replacedItemCode,
                Quantity: roundTo4Decimals(item.weight),
                uom: itemDetails.uom,
                LocationCode: itemDetails.location,
                BIN: "",
                line_no: lineNumber,
                type: "consumption",
                date_time: item.date_time || dateTime,
                user: item.user || "DefaultUser"
            });

            // Create special order for G8900
            if (specialItems.includes(replacedItemCode)) {
                const specialOrder = createSpecialProductionOrder(
                    { ItemNo: replacedItemCode, Quantity: item.weight, uom: itemDetails.uom, LocationCode: itemDetails.location },
                    dateTime,
                    replaceItemIfNeeded(outputItem.item_code)
                );
                productionOrders.push(specialOrder);
            }
        });

        productionOrders.push(mainProductionOrder);

        // Handle spice premix orders
        mainProductionOrder.ProductionJournalLines.forEach((line) => {
            const spicePremixOutput = spicePremixData.find(row => row["output_item"] === line.ItemNo);

            if (spicePremixOutput) {
                const spiceOutputQty = roundTo4Decimals(line.Quantity);
                const spicePremixOrder = {
                    production_order_no: `SP_${line.ItemNo}_${Date.now()}`,
                    ItemNo: spicePremixOutput["output_item"],
                    Quantity: spiceOutputQty,
                    uom: spicePremixOutput["output_uom"],
                    LocationCode: spicePremixOutput["output_location_code"],
                    BIN: "",
                    user: "DefaultUser",
                    line_no: 1000,
                    routing: "production_spice_premixing.bc",
                    date_time: dateTime,
                    ProductionJournalLines: []
                };

                // Add spice premix output line
                spicePremixOrder.ProductionJournalLines.push({
                    ItemNo: spicePremixOutput["output_item"],
                    Quantity: spiceOutputQty,
                    uom: spicePremixOutput["output_uom"],
                    LocationCode: spicePremixOutput["output_location_code"],
                    BIN: "",
                    line_no: 1000,
                    type: "output",
                    date_time: dateTime,
                    user: "DefaultUser"
                });

                // Add consumption lines
                spicePremixData
                    .filter(row => row["output_item"] === spicePremixOutput["output_item"])
                    .forEach((spiceRow, index) => {
                        const consumptionLine = {
                            ItemNo: replaceItemIfNeeded(spiceRow["input_item_code"]),
                            Quantity: roundTo4Decimals(
                                (spiceOutputQty / spiceRow["output_batch_size"]) * spiceRow["input_qty_pe"]
                            ),
                            uom: spiceRow["input_uom"],
                            LocationCode: spiceRow["input_location_code"],
                            BIN: "",
                            line_no: 2000 + index * 1000,
                            type: "consumption",
                            date_time: dateTime,
                            user: "DefaultUser"
                        };

                        spicePremixOrder.ProductionJournalLines.push(consumptionLine);

                        // Create special order for G8900 in spice premix
                        if (specialItems.includes(consumptionLine.ItemNo)) {
                            const specialOrder = createSpecialProductionOrder(
                                { ItemNo: consumptionLine.ItemNo, Quantity: consumptionLine.Quantity, uom: consumptionLine.uom, LocationCode: consumptionLine.LocationCode },
                                dateTime,
                                spicePremixOutput["output_item"]
                            );
                            productionOrders.push(specialOrder);
                        }
                    });

                productionOrders.push(spicePremixOrder);
            }
        });
    }

    productionOrders.sort((a, b) => {
        const isSpecialA = a.production_order_no.startsWith("WP_") ? 0 : 2;
        const isSpiceA = a.production_order_no.startsWith("SP_") ? 1 : 2;
        const isSpecialB = b.production_order_no.startsWith("WP_") ? 0 : 2;
        const isSpiceB = b.production_order_no.startsWith("SP_") ? 1 : 2;

        const priorityA = Math.min(isSpecialA, isSpiceA);
        const priorityB = Math.min(isSpecialB, isSpiceB);

        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        return 0;
    });

    return productionOrders;
};


// Example usage
const jsonData = {"0":{"id":"343244","chopping_id":"1230K31-17","item_code":"G2005","weight":"16.90","output":"0","batch_no":null,"created_at":"2024-12-04 01:28:17.090","updated_at":"2024-12-04 01:28:17.090","timestamp":"2024-12-04 01:29:59"},"1":{"id":"343256","chopping_id":"1230K31-17","item_code":"G2011","weight":"27.30","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:08.290","updated_at":"2024-12-04 01:29:08.290","timestamp":"2024-12-04 01:29:59"},"2":{"id":"343257","chopping_id":"1230K31-17","item_code":"G8900","weight":"16.00","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:18.337","updated_at":"2024-12-04 01:29:18.337","timestamp":"2024-12-04 01:29:59"},"3":{"id":"343258","chopping_id":"1230K31-17","item_code":"G2159","weight":"48.30","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:32.560","updated_at":"2024-12-04 01:29:32.560","timestamp":"2024-12-04 01:29:59"},"4":{"id":"343262","chopping_id":"1230K31-17","item_code":"G2155","weight":"10.10","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:57.540","updated_at":"2024-12-04 01:29:57.540","timestamp":"2024-12-04 01:29:59"},"5":{"id":"343263","chopping_id":"1230K31-17","item_code":"G2109","weight":".14","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"6":{"id":"343264","chopping_id":"1230K31-17","item_code":"G2126","weight":"3.20","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"7":{"id":"343265","chopping_id":"1230K31-17","item_code":"H133003","weight":".32","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"8":{"id":"343266","chopping_id":"1230K31-17","item_code":"H133014","weight":".32","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"9":{"id":"343267","chopping_id":"1230K31-17","item_code":"H221016","weight":"1.20","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"10":{"id":"343268","chopping_id":"1230K31-17","item_code":"H231008","weight":"6.00","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"11":{"id":"343269","chopping_id":"1230K31-17","item_code":"H231017","weight":"12.00","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"12":{"id":"343270","chopping_id":"1230K31-17","item_code":"H231025","weight":"3.00","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"13":{"id":"343271","chopping_id":"1230K31-17","item_code":"H231068","weight":"9.00","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"14":{"id":"343272","chopping_id":"1230K31-17","item_code":"G2206","weight":"152.58","output":"1","batch_no":null,"created_at":"2024-12-04 01:29:59.957","updated_at":"2024-12-04 01:29:59.957","timestamp":"2024-12-04 01:29:59"},"company_name":"FCL"}

try {
    const productionOrders = transformData(jsonData);
    console.log("Transformed Production Orders:", JSON.stringify(productionOrders, null, 2));
} catch (error) {
    console.error("Error:", error.message);
}
