import fs from 'fs';
import xlsx from 'xlsx';
import logger from '../../logger.js'; 
import { poolPromise } from '../../config/default.js';
import sql from 'mssql';
import { time, timeStamp } from 'console';

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
    // Ensure the data is always treated as an array
    const data = Array.isArray(responseData) ? responseData : [responseData];

    // Group data by chopping_id
    const groupedData = data.reduce((acc, item) => {
        const { chopping_id } = item;
        if (!acc[chopping_id]) {
            acc[chopping_id] = { chopping_id, lines: [] };
        }
        acc[chopping_id].lines.push(item);
        return acc;
    }, {});

    return createProductionOrder(groupedData);

}
export const createProductionOrder = async (groupedData) => {
    const productionOrders = [];

    // Iterate over grouped data
    for (const [chopping_id, { lines }] of Object.entries(groupedData)) {
        if (!lines || lines.length === 0) continue;

        // Access the inner `lines` property
        const allLines = lines.flatMap((item) => item.lines || []);
        if (!allLines || allLines.length === 0) continue;

        // Find the output line (output === 1)
        const outputLine = allLines.find((line) => line.output === 1);
        if (!outputLine) {
            console.warn(`No output item found for chopping_id: ${chopping_id}`);
            continue;
        }

        // Create the production order
        const productionOrder = {
            production_order_no: chopping_id,
            ItemNo: outputLine.item_code,
            Quantity: roundTo4Decimals(outputLine.weight),
            uom: 'KG', // Replace with actual UOM if applicable
            LocationCode: '2055', // Replace with actual location code
            BIN: '',
            routing: 'chopping',
            user: 'wms_bc',
            date_time: outputLine.timestamp,
            line_no: 1000,
            timestamp: outputLine.timestamp,
            ProductionJournalLines: allLines.map((line, index) => ({
                ItemNo: line.item_code,
                Quantity: roundTo4Decimals(line.weight),
                type: line.output === 0 ? 'consumption' : 'output',
                location: '2055', // Replace with actual location if available
                uom: 'KG', // Replace with actual UOM if applicable
                date_time: line.timestamp || new Date().toISOString(),
                user: 'wms_bc',
                line_no: 1000 + index * 1000, // Increment line_no for each item
            })),
        };

         //loop through each of the consumption lines and check for special items
        


         
        // Add the production order to the result
        productionOrders.push(productionOrder);
    }

    return productionOrders;
};
