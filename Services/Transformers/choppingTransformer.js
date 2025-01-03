import fs from 'fs';
import xlsx from 'xlsx';
import logger from '../../logger.js'; 
import { poolPromise } from '../../config/default.js';
import sql from 'mssql';

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
    "G2155": "G2007",
    "H131001":"H231051"
};

// Replace item if needed
const replaceItemIfNeeded = (itemNo) => replaceItems[itemNo] || itemNo;

// Create a special production order
const createSpecialProductionOrder = (specialItem, dateTime, context) => {
    const uniquePart = Date.now() % 100000;

    console.log("Special Item:", specialItem);
    return {
        production_order_no: `WP${specialItem.ItemNo}${context}_${uniquePart}`,
        ItemNo: specialItem.ItemNo,
        Quantity: roundTo4Decimals(specialItem.Quantity),
        uom: specialItem.uom,
        LocationCode: specialItem.LocationCode,
        BIN: "",
        user: "",
        line_no: 1000,
        routing: "special_production.bc",
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
                user: "",
               
            }
        ]
    };
};

// Function to remove journal lines with zero quantity
const removeZeroQuantityLines = (productionOrders) => {
    return productionOrders.map(order => {
        // Filter out journal lines with Quantity === 0
        const filteredJournalLines = order.ProductionJournalLines.filter(line => line.Quantity > 0);

        // Return a new order with updated journal lines
        return {
            ...order,
            ProductionJournalLines: filteredJournalLines
        };
    });
};

export const transformData = async (responseData) => {
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
    const specialItemQuantities = {}; // Accumulate quantities for special items

    for (const groupKey in groupedItems) {
        const items = groupedItems[groupKey];
        const dateTime = new Date(items[0]?.timestamp || Date.now()).toISOString();
        const outputItem = items.find(item => item.output === "1" || item.output === 1);
        const consumptionItems = items.filter(item => item.output === "0" || item.output === 0);

        if (!outputItem) {
            throw new Error("No output entry found in the data");
        }

        const resolveItemDetails = async (itemCode, output) => {
            try {
                const pool = await poolPromise;
                const query = output
                    ? `SELECT output_item_location AS location, output_item_uom AS uom FROM RecipeData WHERE output_item = @itemCode`
                    : `SELECT input_item_location AS location, input_item_uom AS uom FROM RecipeData WHERE input_item = @itemCode`;

                const result = await pool
                    .request()
                    .input("itemCode", sql.VarChar, itemCode)
                    .query(query);

                const record = result.recordset[0];
                if (!record) {
                    console.error(`No matching record found for itemCode: ${itemCode} as output: ${output}`);
                    return {
                        location: "2055",
                        uom: "KG",
                    };
                }

                return {
                    location: record.location || "2055",
                    uom: record.uom || "KG",
                };
            } catch (error) {
                console.error(`Error resolving item details: ${itemCode} as output: ${output} ${error.message}`);
                return {
                    location: "2055",
                    uom: "KG",
                };
            }
        };

        const outputDetails = await resolveItemDetails(outputItem.item_code, true);

        const mainProductionOrder = {
            production_order_no: `${outputItem.chopping_id}_${outputItem.id}`,
            ItemNo: replaceItemIfNeeded(outputItem.item_code),
            Quantity: roundTo4Decimals(outputItem.weight),
            uom: outputDetails.uom,
            LocationCode: outputDetails.location,
            BIN: "",
            user: "DefaultUser",
            line_no: 1000,
            routing: "production_data_chopping.bc",
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

        // Add consumption lines using Promise.all
        const consumptionPromises = consumptionItems.map(async (item, index) => {
            const replacedItemCode = replaceItemIfNeeded(item.item_code);
            const lineNumber = 2000 + index * 1000;
            const itemDetails = await resolveItemDetails(replacedItemCode, false);

            // Check if the item already exists in ProductionJournalLines
            const existingLine = mainProductionOrder.ProductionJournalLines.find(
                line => line.ItemNo === replacedItemCode && line.type === "consumption"
            );

            if (existingLine) {
                // Update the quantity for the existing line
                existingLine.Quantity += roundTo4Decimals(item.weight);
            } else {
                // Add a new line
                mainProductionOrder.ProductionJournalLines.push({
                    ItemNo: replacedItemCode,
                    Quantity: roundTo4Decimals(item.weight),
                    uom: itemDetails.uom,
                    LocationCode: itemDetails.location,
                    BIN: "",
                    line_no: lineNumber,
                    type: "consumption",
                    date_time: item.date_time || dateTime,
                    user: item.user || ""
                });
            }

            // Accumulate quantities for special items
            if (specialItems.includes(replacedItemCode)) {
                if (!specialItemQuantities[replacedItemCode]) {
                    specialItemQuantities[replacedItemCode] = {
                        Quantity: 0,
                        LocationCode: itemDetails.location,
                        uom: itemDetails.uom,
                    };
                }
                specialItemQuantities[replacedItemCode].Quantity += roundTo4Decimals(item.weight);
            }
        });

        await Promise.all(consumptionPromises);

        productionOrders.push(mainProductionOrder);

        // Handle spice premix orders
        mainProductionOrder.ProductionJournalLines.forEach((line) => {
            const spicePremixOutput = spicePremixData.find(row => row["output_item"] === line.ItemNo);
            const uniquePart = Date.now() % 100000;
            if (spicePremixOutput) {
                const spiceOutputQty = roundTo4Decimals(line.Quantity);
                const spicePremixOrder = {
                    production_order_no: `SP_${line.ItemNo}_${uniquePart}`,
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
                                {
                                    ItemNo: consumptionLine.ItemNo,
                                    Quantity: consumptionLine.Quantity,
                                    uom: consumptionLine.uom,
                                    LocationCode: consumptionLine.LocationCode
                                },
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

    // Consolidate special orders
    for (const itemCode in specialItemQuantities) {
        const details = specialItemQuantities[itemCode];
        const uniquePart = Date.now() % 100000;
        const specialOrder = {
            production_order_no: `SP_${itemCode}_${uniquePart}`,
            ItemNo: itemCode,
            Quantity: roundTo4Decimals(details.Quantity),
            uom: details.uom,
            LocationCode: details.LocationCode,
            BIN: "",
            user: "DefaultUser",
            line_no: 1000,
            routing: "special_production.bc",
            date_time: new Date().toISOString(),
            ProductionJournalLines: [
                {
                    ItemNo: itemCode,
                    Quantity: roundTo4Decimals(details.Quantity),
                    uom: details.uom,
                    LocationCode: details.LocationCode,
                    BIN: "",
                    line_no: 1000,
                    type: "output",
                    date_time: new Date().toISOString(),
                    user: "DefaultUser"
                }
            ]
        };

        productionOrders.push(specialOrder);
    }

    // Remove lines with zero quantity
    const cleanedProductionOrders = removeZeroQuantityLines(productionOrders);

    // Sort orders: special orders first, then spice premix, then main orders
    cleanedProductionOrders.sort((a, b) => {
        const isSpecialA = a.production_order_no.startsWith("WP") ? 0 : 2;
        const isSpiceA = a.production_order_no.startsWith("SP") ? 1 : 2;
        const isSpecialB = b.production_order_no.startsWith("WP") ? 0 : 2;
        const isSpiceB = b.production_order_no.startsWith("SP") ? 1 : 2;

        const priorityA = Math.min(isSpecialA, isSpiceA);
        const priorityB = Math.min(isSpecialB, isSpiceB);

        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        return 0;
    });

    return cleanedProductionOrders;
};






// // // Example usage
// const jsonData = {"0":{"id":"345615","chopping_id":"1230L83-90","item_code":"G2044","weight":"15.60","output":"0","batch_no":null,"created_at":"2024-12-04 08:38:08.863","updated_at":"2024-12-04 08:38:08.863","timestamp":"2024-12-04 08:41:13"},"1":{"id":"345616","chopping_id":"1230L83-90","item_code":"G2016","weight":"14.50","output":"0","batch_no":null,"created_at":"2024-12-04 08:38:40.220","updated_at":"2024-12-04 08:38:40.220","timestamp":"2024-12-04 08:41:13"},"2":{"id":"345617","chopping_id":"1230L83-90","item_code":"G2007","weight":"9.10","output":"0","batch_no":null,"created_at":"2024-12-04 08:38:59.513","updated_at":"2024-12-04 08:38:59.513","timestamp":"2024-12-04 08:41:13"},"3":{"id":"345619","chopping_id":"1230L83-90","item_code":"G2150","weight":"14.50","output":"0","batch_no":null,"created_at":"2024-12-04 08:39:30.220","updated_at":"2024-12-04 08:39:30.220","timestamp":"2024-12-04 08:41:13"},"4":{"id":"345622","chopping_id":"1230L83-90","item_code":"G2161","weight":"23.70","output":"0","batch_no":null,"created_at":"2024-12-04 08:40:23.393","updated_at":"2024-12-04 08:40:23.393","timestamp":"2024-12-04 08:41:13"},"5":{"id":"345623","chopping_id":"1230L83-90","item_code":"G2001","weight":"9.20","output":"0","batch_no":null,"created_at":"2024-12-04 08:40:41.050","updated_at":"2024-12-04 08:40:41.050","timestamp":"2024-12-04 08:41:13"},"6":{"id":"345624","chopping_id":"1230L83-90","item_code":"G8900","weight":"9.30","output":"0","batch_no":null,"created_at":"2024-12-04 08:41:04.223","updated_at":"2024-12-04 08:41:04.223","timestamp":"2024-12-04 08:41:13"},"7":{"id":"345625","chopping_id":"1230L83-90","item_code":"G2107","weight":"1.70","output":"0","batch_no":null,"created_at":"2024-12-04 08:41:12.963","updated_at":"2024-12-04 08:41:12.963","timestamp":"2024-12-04 08:41:13"},"8":{"id":"345626","chopping_id":"1230L83-90","item_code":"G2109","weight":".30","output":"0","batch_no":null,"created_at":"2024-12-04 08:41:12.963","updated_at":"2024-12-04 08:41:12.963","timestamp":"2024-12-04 08:41:13"},"9":{"id":"345627","chopping_id":"1230L83-90","item_code":"G2128","weight":".94","output":"0","batch_no":null,"created_at":"2024-12-04 08:41:12.963","updated_at":"2024-12-04 08:41:12.963","timestamp":"2024-12-04 08:41:13"},"10":{"id":"345628","chopping_id":"1230L83-90","item_code":"H133020","weight":"2.00","output":"0","batch_no":null,"created_at":"2024-12-04 08:41:12.963","updated_at":"2024-12-04 08:41:12.963","timestamp":"2024-12-04 08:41:13"},"11":{"id":"345629","chopping_id":"1230L83-90","item_code":"H133023","weight":"8.00","output":"0","batch_no":null,"created_at":"2024-12-04 08:41:12.963","updated_at":"2024-12-04 08:41:12.963","timestamp":"2024-12-04 08:41:13"},"12":{"id":"345630","chopping_id":"1230L83-90","item_code":"H221016","weight":"1.12","output":"0","batch_no":null,"created_at":"2024-12-04 08:41:12.963","updated_at":"2024-12-04 08:41:12.963","timestamp":"2024-12-04 08:41:13"},"13":{"id":"345631","chopping_id":"1230L83-90","item_code":"H231017","weight":"8.00","output":"0","batch_no":null,"created_at":"2024-12-04 08:41:12.963","updated_at":"2024-12-04 08:41:12.963","timestamp":"2024-12-04 08:41:13"},"14":{"id":"345632","chopping_id":"1230L83-90","item_code":"H231025","weight":"2.50","output":"0","batch_no":null,"created_at":"2024-12-04 08:41:12.963","updated_at":"2024-12-04 08:41:12.963","timestamp":"2024-12-04 08:41:13"},"15":{"id":"345633","chopping_id":"1230L83-90","item_code":"H231068","weight":"7.50","output":"0","batch_no":null,"created_at":"2024-12-04 08:41:12.963","updated_at":"2024-12-04 08:41:12.963","timestamp":"2024-12-04 08:41:13"},"16":{"id":"345634","chopping_id":"1230L83-90","item_code":"G8900","weight":"18.00","output":"0","batch_no":null,"created_at":"2024-12-04 08:41:12.963","updated_at":"2024-12-04 08:41:12.963","timestamp":"2024-12-04 08:41:13"},"17":{"id":"345635","chopping_id":"1230L83-90","item_code":"G2223","weight":"144.84","output":"1","batch_no":null,"created_at":"2024-12-04 08:41:13.010","updated_at":"2024-12-04 08:41:13.010","timestamp":"2024-12-04 08:41:13"},"company_name":"FCL"}

// try {
//     const productionOrders = await transformData(jsonData);
//     console.log("Transformed Production Orders:", JSON.stringify(productionOrders, null, 2));
// } catch (error) {
//     console.error("Error:", error.message);
// }
