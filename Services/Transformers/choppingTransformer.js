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

const resolveSpicePremixConsumption = (outputQty, spicePremixRow) => {
    return {
        ItemNo: spicePremixRow["input_item_code"],
        Quantity: (outputQty / spicePremixRow["output_batch_size"]) * spicePremixRow["input_qty_pe"],
        uom: spicePremixRow["input_uom"],
        LocationCode: spicePremixRow["input_location_code"],
        BIN: "",
        line_no: null,
        type: "consumption", // Ensure type is consumption for ingredients
        date_time: new Date().toISOString(),
        user: "DefaultUser"
    };
};
const roundTo4Decimals = (value) => {
    if (isNaN(value) || value === null || value === undefined) {
        throw new Error(`Invalid number: ${value}`);
    }
    return parseFloat(Number(value).toFixed(4));
};


const createSpecialProductionOrder = (specialItem, dateTime) => {
    return {
        production_order_no: `WP_${specialItem.ItemNo}_${Date.now()}`,
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
    const specialItems = ["G8900", "G8901"]; // Define special items here

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
                location: resolveLocationCode(itemCode, "Chopping", sheetData),
                uom: resolveUnitOfMeasure(itemCode, "Chopping", sheetData) || "KG"
            };
        };

        const outputDetails = resolveItemDetails(outputItem.item_code);

        const mainProductionOrder = {
            production_order_no: `${outputItem.chopping_id}_${outputItem.id}`,
            ItemNo: outputItem.item_code,
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

        const addedItems = new Set();

        // Add output line
        mainProductionOrder.ProductionJournalLines.push({
            ItemNo: outputItem.item_code,
            Quantity: roundTo4Decimals(outputItem.weight),
            uom: outputDetails.uom,
            LocationCode: outputDetails.location,
            BIN: "",
            line_no: 1000,
            type: "output",
            date_time: dateTime,
            user: "DefaultUser"
        });
        addedItems.add(outputItem.item_code);

        // Add consumption lines
        consumptionItems.forEach((item, index) => {
            if (!addedItems.has(item.item_code)) {
                const lineNumber = 2000 + index * 1000;
                const itemDetails = resolveItemDetails(item.item_code);

                mainProductionOrder.ProductionJournalLines.push({
                    ItemNo: item.item_code,
                    Quantity: roundTo4Decimals(item.weight),
                    uom: itemDetails.uom || "KG",
                    LocationCode: itemDetails.location || "2055",
                    BIN: item.BIN || "",
                    line_no: lineNumber,
                    type: "consumption",
                    date_time: item.date_time || dateTime,
                    user: item.user || "DefaultUser"
                });
                addedItems.add(item.item_code);
            }
        });

        productionOrders.push(mainProductionOrder);

        // Check for special items in the main production order
        const specialMainItems = mainProductionOrder.ProductionJournalLines.filter(line =>
            specialItems.includes(line.ItemNo)
        );

        specialMainItems.forEach(specialItem => {
            const specialOrder = createSpecialProductionOrder(specialItem, dateTime);
            productionOrders.push(specialOrder);
        });

        // Check each consumption line in the main production order for spice premix requirements
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

                const uniqueSpiceItems = new Set();

                spicePremixData
                    .filter(row => row["output_item"] === spicePremixOutput["output_item"])
                    .forEach((spiceRow, index) => {
                        const consumptionLine = {
                            ItemNo: spiceRow["input_item_code"],
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

                        if (!uniqueSpiceItems.has(consumptionLine.ItemNo)) {
                            spicePremixOrder.ProductionJournalLines.push(consumptionLine);
                            uniqueSpiceItems.add(consumptionLine.ItemNo);
                        }
                    });

                productionOrders.push(spicePremixOrder);

                // Check for special items in the spice premix production order
                const specialSpiceItems = spicePremixOrder.ProductionJournalLines.filter(spiceLine =>
                    specialItems.includes(spiceLine.ItemNo)
                );

                specialSpiceItems.forEach(specialItem => {
                    const specialOrder = createSpecialProductionOrder(specialItem, dateTime);
                    productionOrders.push(specialOrder);
                });
            }
        });
    }

    // Reorder productionOrders: Special orders come first
productionOrders.sort((a, b) => {
    const isSpecialA = a.production_order_no.startsWith("WP_") ? 0 : 1;
    const isSpecialB = b.production_order_no.startsWith("WP_") ? 0 : 1;

    // Special orders (isSpecialA/B === 0) are prioritized
    if (isSpecialA !== isSpecialB) {
        return isSpecialA - isSpecialB;
    }

    // Maintain original order for non-special orders
    return 0;
});



    return productionOrders;
};






// Example usage
// const jsonData = {"0":{"id":"343244","chopping_id":"1230K31-17","item_code":"G2005","weight":"16.90","output":"0","batch_no":null,"created_at":"2024-12-04 01:28:17.090","updated_at":"2024-12-04 01:28:17.090","timestamp":"2024-12-04 01:29:59"},"1":{"id":"343256","chopping_id":"1230K31-17","item_code":"G2011","weight":"27.30","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:08.290","updated_at":"2024-12-04 01:29:08.290","timestamp":"2024-12-04 01:29:59"},"2":{"id":"343257","chopping_id":"1230K31-17","item_code":"G8900","weight":"16.00","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:18.337","updated_at":"2024-12-04 01:29:18.337","timestamp":"2024-12-04 01:29:59"},"3":{"id":"343258","chopping_id":"1230K31-17","item_code":"G2159","weight":"48.30","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:32.560","updated_at":"2024-12-04 01:29:32.560","timestamp":"2024-12-04 01:29:59"},"4":{"id":"343262","chopping_id":"1230K31-17","item_code":"G2155","weight":"10.10","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:57.540","updated_at":"2024-12-04 01:29:57.540","timestamp":"2024-12-04 01:29:59"},"5":{"id":"343263","chopping_id":"1230K31-17","item_code":"G2109","weight":".14","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"6":{"id":"343264","chopping_id":"1230K31-17","item_code":"G2126","weight":"3.20","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"7":{"id":"343265","chopping_id":"1230K31-17","item_code":"H133003","weight":".32","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"8":{"id":"343266","chopping_id":"1230K31-17","item_code":"H133014","weight":".32","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"9":{"id":"343267","chopping_id":"1230K31-17","item_code":"H221016","weight":"1.20","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"10":{"id":"343268","chopping_id":"1230K31-17","item_code":"H231008","weight":"6.00","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"11":{"id":"343269","chopping_id":"1230K31-17","item_code":"H231017","weight":"12.00","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"12":{"id":"343270","chopping_id":"1230K31-17","item_code":"H231025","weight":"3.00","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"13":{"id":"343271","chopping_id":"1230K31-17","item_code":"H231068","weight":"9.00","output":"0","batch_no":null,"created_at":"2024-12-04 01:29:59.917","updated_at":"2024-12-04 01:29:59.917","timestamp":"2024-12-04 01:29:59"},"14":{"id":"343272","chopping_id":"1230K31-17","item_code":"G2206","weight":"152.58","output":"1","batch_no":null,"created_at":"2024-12-04 01:29:59.957","updated_at":"2024-12-04 01:29:59.957","timestamp":"2024-12-04 01:29:59"},"company_name":"FCL"}

// try {
//     const productionOrders = transformData(jsonData);
//     console.log("Transformed Production Orders:", JSON.stringify(productionOrders, null, 2));
// } catch (error) {
//     console.error("Error:", error.message);
// }
