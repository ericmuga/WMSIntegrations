import sql from 'mssql';
import { poolPromise } from '../../config/default.js'; // Database connection pool
import logger from '../../logger.js';

const roundTo4Decimals = (num) => {
    const validNum = parseFloat(num);
    if (isNaN(validNum)) {
        throw new Error(`Invalid number: ${num}`);
    }
    return parseFloat(validNum.toFixed(4));
};

const fetchBOMData = async (process, outputItem) => {
    const pool = await poolPromise;
    const query = `
        SELECT * 
        FROM RecipeData
        WHERE Process = @process AND output_item = @outputItem;
    `;
    const result = await pool
        .request()
        .input('process', sql.VarChar, process)
        .input('outputItem', sql.VarChar, outputItem)
        .query(query);
    return result.recordset;
};

export const transformData = async (transferData) => {
    try {
        const {
            product_code,
            transfer_from_location,
            transfer_to_location,
            receiver_total_weight,
            id,
            timestamp
        } = transferData;

        // const timestamp = Date.now();
        const dateTime = new Date().toISOString();
        const user = 'DefaultUser';

        // Fetch BOM data for packing
        const packingBOM = await fetchBOMData('Packing', product_code);
        if (!packingBOM.length) {
            logger.error(`No packing BOM data found for output_item: ${product_code}`);
            return [];
        }

        // Find main intake item for stuffing
        const mainStuffingItem = packingBOM.find((row) => row.input_item && row.input_item.startsWith('G'));
        if (!mainStuffingItem) {
            logger.error(`No main intake item starting with "G" found in the packing BOM for output_item: ${product_code}`);
            return [];
        }

        const stuffingOutputItem = mainStuffingItem.input_item;

        // Fetch BOM data for stuffing
        const stuffingBOM = await fetchBOMData('Stuffing', stuffingOutputItem);
        if (!stuffingBOM.length) {
            logger.error(`No stuffing BOM data found for output_item: ${stuffingOutputItem}`);
            return [];
        }

        // Calculate the batch multiplier
        const standardBatchSize = parseFloat(packingBOM[0].batch_size);
        if (!standardBatchSize) {
            logger.error(`No batch size (batch_size) found in the BOM for output_item: ${product_code}`);
            return [];
        }
        const batchMultiplier = receiver_total_weight / standardBatchSize;

        const uniqueStuffingBOM = stuffingBOM.reduce((acc, row) => {
            if (!acc.some(item => item.input_item === row.input_item)) {
                acc.push(row);
            }
            return acc;
        }, []);

        // Generate the packing production order
        const packingOrder = {
            production_order_no: `PK_${product_code}_${id}`,
            ItemNo: product_code,
            Quantity: roundTo4Decimals(receiver_total_weight),
            uom: packingBOM[0].output_item_uom,
            LocationCode: transfer_to_location,
            BIN: '',
            user,
            line_no: 1000,
            routing: 'production_data_packing.bc',
            date_time: dateTime,
            ProductionJournalLines: [
                {
                    ItemNo: product_code,
                    Quantity: roundTo4Decimals(receiver_total_weight),
                    uom: packingBOM[0].output_item_uom,
                    LocationCode: transfer_to_location,
                    BIN: '',
                    line_no: 1000,
                    type: 'output',
                    date_time: dateTime,
                    user,
                },
                ...packingBOM.reduce((acc, row, index) => {
                    if (!acc.some((item) => item.ItemNo === row.input_item)) {
                        acc.push({
                            ItemNo: row.input_item,
                            Quantity: roundTo4Decimals(batchMultiplier * parseFloat(row.input_item_qt_per)),
                            uom: row.input_item_uom,
                            LocationCode: row.input_item_location,
                            BIN: '',
                            line_no: 2000 + index * 1000,
                            type: 'consumption',
                            date_time: dateTime,
                            user,
                        });
                    }
                    return acc;
                }, []),
            ],
        };

        // Calculate the stuffing output quantity and multiplier
        const stuffingOutputQuantity = batchMultiplier * parseFloat(mainStuffingItem.input_item_qt_per);
        // const stuffingBatchMultiplier = stuffingOutputQuantity / parseFloat(mainStuffingItem.input_item_qt_per);
         
        const stuffingOrder = {
            production_order_no: `ST_${stuffingOutputItem}_${id}`,
            ItemNo: stuffingOutputItem,
            Quantity: roundTo4Decimals(stuffingOutputQuantity),
            uom: mainStuffingItem.output_item_uom,
            LocationCode: transfer_from_location,
            BIN: '',
            user,
            line_no: 1000,
            routing: 'production_data_stuffing.bc',
            date_time: dateTime,
            ProductionJournalLines: [
                {
                    ItemNo: stuffingOutputItem,
                    Quantity: roundTo4Decimals(stuffingOutputQuantity),
                    uom: mainStuffingItem.output_item_uom,
                    LocationCode: transfer_from_location,
                    BIN: '',
                    line_no: 1000,
                    type: 'output',
                    date_time: dateTime,
                    user,
                },
                ...uniqueStuffingBOM.map((row, index) => ({
                    ItemNo: row.input_item,
                    Quantity: roundTo4Decimals(stuffingOutputQuantity/uniqueStuffingBOM[0].batch_size * parseFloat(row.input_item_qt_per)),
                    uom: row.input_item_uom,
                    LocationCode: row.input_item_location,
                    BIN: '',
                    line_no: 2000 + index * 1000,
                    type: 'consumption',
                    date_time: dateTime,
                    user,
                })),
            ],
        };

        return [stuffingOrder, packingOrder];
    } catch (error) {
        logger.error(`Error generating production orders: ${error.message}`);
        return [];
    }
};


// Example usage
// const jsonData = {
//     product_code: "J31015401",
//     transfer_from_location: "2055",
//     transfer_to_location: "3535",
//     receiver_total_weight: 169
// };

// (async () => {
//     try {
//         const data = await transformData(jsonData);
//         console.log(JSON.stringify(data, null, 2)); // Pretty-print the output
//     } catch (error) {
//         logger.error('Error:', error.message);
//     }
// })();
