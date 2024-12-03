import xlsx from 'xlsx';
import path from 'path';

// Load the BOM data from the Excel file
const bomFilePath = path.resolve('./PackingStuffing.xlsx'); // Update with the actual path
const workbook = xlsx.readFile(bomFilePath);
const bomSheet = workbook.Sheets[workbook.SheetNames[0]];
const bomData = xlsx.utils.sheet_to_json(bomSheet);

/**
 * Rounds a number to 4 decimal places, ensuring it is a valid number.
 * @param {number|string} num - The number to round.
 * @returns {number} - The rounded number.
 */
const roundTo4DP = (num) => {
    const validNum = parseFloat(num);
    if (isNaN(validNum)) {
        throw new Error(`Invalid number: ${num}`);
    }
    return parseFloat(validNum.toFixed(4));
};

/**
 * Transform data from the RabbitMQ message into production orders.
 * @param {Object} transferData - The RabbitMQ message data.
 * @returns {Array} - An array of production orders.
 */
export const transformData = (transferData) => {
    const {
        product_code, // The output item for the packing production order
        transfer_from_location,
        transfer_to_location,
        receiver_total_weight // The total output weight from RabbitMQ
    } = transferData;

    const timestamp = Date.now(); // Current timestamp in digits
    const dateTime = new Date().toISOString(); // Current timestamp in ISO format
    const user = 'DefaultUser';

    // Filter BOM data for packing
    const packingBOM = bomData.filter(row => row.Process === 'Packing' && row['output_item'] === product_code);
    if (!packingBOM.length) {
        throw new Error(`No packing BOM data found for output_item: ${product_code}`);
    }

    // Determine the main intake item for packing (starts with "G")
    const mainStuffingItem = packingBOM.find(row => row['Input Item'] && row['Input Item'].startsWith('G'));
    if (!mainStuffingItem) {
        throw new Error(`No main intake item starting with "G" found in the packing BOM for output_item: ${product_code}`);
    }

    const stuffingOutputItem = mainStuffingItem['Input Item'];

    // Filter BOM data for stuffing
    const stuffingBOM = bomData.filter(row => row.Process === 'Stuffing' && row['output_item'] === stuffingOutputItem);
    if (!stuffingBOM.length) {
        throw new Error(`No stuffing BOM data found for output_item: ${stuffingOutputItem}`);
    }

    // Determine the standard batch size from BOM
    const standardBatchSize = parseFloat(packingBOM[0]['output_batch_size']);
    if (!standardBatchSize) {
        throw new Error(`No standard batch size (output_batch_size) found in the BOM for output_item: ${product_code}`);
    }

    // Calculate the batch multiplier
    const batchMultiplier = receiver_total_weight / standardBatchSize;

    // Deduplicate stuffing BOM lines by `Input Item`
    const uniqueStuffingBOM = stuffingBOM.reduce((acc, row) => {
        if (!acc.some(item => item['Input Item'] === row['Input Item'])) {
            acc.push(row);
        }
        return acc;
    }, []);

    // Packing Production Order
    const packingOrder = {
        production_order_no: `PK_${timestamp}`,
        ItemNo: product_code,
        Quantity: roundTo4DP(receiver_total_weight),
        uom: packingBOM[0]['output_uom'], // UOM from the BOM
        LocationCode: transfer_to_location,
        BIN: '',
        user,
        line_no: 1000,
        routing: 'production_data_packing.bc',
        date_time: dateTime,
        ProductionJournalLines: [
            {
                ItemNo: product_code,
                Quantity: roundTo4DP(receiver_total_weight),
                uom: packingBOM[0]['output_uom'],
                LocationCode: transfer_to_location,
                BIN: '',
                line_no: 1000,
                type: 'output',
                date_time: dateTime,
                user
            },
            ...packingBOM.map((row, index) => ({
                ItemNo: row['Input Item'],
                Quantity: roundTo4DP(batchMultiplier * parseFloat(row['Usage per batch'])),
                uom: row['intake_uom'],
                LocationCode: row['Input Location code'],
                BIN: '',
                line_no: 2000 + index * 1000,
                type: 'consumption',
                date_time: dateTime,
                user
            }))
        ]
    };

    // Stuffing Production Order
    const stuffingOutputQuantity = batchMultiplier * parseFloat(mainStuffingItem['Usage per batch']);
    const stuffingBatchMultiplier = stuffingOutputQuantity / parseFloat(mainStuffingItem['Usage per batch']);

    const stuffingOrder = {
        production_order_no: `ST_${timestamp}`,
        ItemNo: stuffingOutputItem, // The main intake item from packing BOM
        Quantity: roundTo4DP(stuffingOutputQuantity),
        uom: mainStuffingItem['output_uom'], // UOM for the stuffing output
        LocationCode: transfer_from_location,
        BIN: '',
        user,
        line_no: 1000,
        routing: 'production_data_stuffing.bc',
        date_time: dateTime,
        ProductionJournalLines: [
            {
                ItemNo: stuffingOutputItem,
                Quantity: roundTo4DP(stuffingOutputQuantity),
                uom: mainStuffingItem['output_uom'],
                LocationCode: transfer_from_location,
                BIN: '',
                line_no: 1000,
                type: 'output',
                date_time: dateTime,
                user
            },
            ...uniqueStuffingBOM.map((row, index) => ({
                ItemNo: row['Input Item'],
                Quantity: roundTo4DP(stuffingBatchMultiplier * parseFloat(row['Usage per batch'])),
                uom: row['intake_uom'],
                LocationCode: row['Input Location code'],
                BIN: '',
                line_no: 2000 + index * 1000,
                type: 'consumption',
                date_time: dateTime,
                user
            }))
        ]
    };

    // Return both production orders
    return [stuffingOrder, packingOrder];
};
