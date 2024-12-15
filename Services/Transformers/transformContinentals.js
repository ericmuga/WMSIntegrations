
import logger from '../../logger.js';
import { roundTo4Decimals, fetchBOMData } from '../Utils/utilities.js';


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

        const dateTime = new Date(timestamp).toISOString();
        const user = 'DefaultUser';

        // Fetch BOM data for packing
        const packingBOM = await fetchBOMData('Packing', product_code);
        
        if (!packingBOM.length) {
            logger.error(`No packing BOM data found for output_item: ${product_code}`);
            return [];
        }

        // Find main intake item for smoking
        const mainSmokingItem = packingBOM.find((row) => row.input_item && row.input_item.startsWith('G'));
        
        if (!mainSmokingItem) {
            logger.error(`No main intake item starting with "G" found in the packing BOM for output_item: ${product_code}`);
            return [];
        }

        const smokingOutputItem = mainSmokingItem.input_item;

        // Fetch BOM data for smoking
        const smokingBOM = await fetchBOMData('Smoking', smokingOutputItem);
       
        if (!smokingBOM.length) {
            logger.error(`No smoking BOM data found for output_item: ${smokingOutputItem}`);
            return [];
        }

        // Calculate the batch multiplier for packing
        const standardBatchSize = parseFloat(packingBOM[0].batch_size);
        if (!standardBatchSize) {
            logger.error(`No batch size (batch_size) found in the BOM for output_item: ${product_code}`);
            return [];
        }
        const batchMultiplier = receiver_total_weight / standardBatchSize;

        // Generate the packing production order
        // Generate the packing production order
const packingOrder = {
    production_order_no: `${packingBOM[0].recipe}_${id}`,
    ItemNo: product_code,
    Quantity: roundTo4Decimals(receiver_total_weight),
    uom: packingBOM[0].output_item_uom,
    LocationCode: transfer_to_location,
    BIN: '',
    user,
    line_no: 1000,
    routing: 'continentals',
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
            acc.push({
                ItemNo: row.input_item,
                Quantity: roundTo4Decimals(batchMultiplier * parseFloat(row.input_item_qt_per)),
                uom: row.input_item_uom, // Added uom from BOM data
                LocationCode: row.input_item_location, // Added LocationCode from BOM data
                BIN: '',
                line_no: 2000 + index * 1000,
                type: 'consumption',
                date_time: dateTime,
                user,
            });
            return acc;
        }, []),
    ],
};

        // Generate the smoking production order
        const smokingOutputQuantity = batchMultiplier * parseFloat(mainSmokingItem.input_item_qt_per);
        const smokingOrder = {
            production_order_no: `${smokingBOM[0].recipe}_${id}`,
            ItemNo: smokingOutputItem,
            Quantity: roundTo4Decimals(smokingOutputQuantity),
            uom: smokingBOM[0].output_item_uom,
            LocationCode: transfer_to_location,
            BIN: '',
            user,
            line_no: 1000,
            routing: 'continentals',
            date_time: dateTime,
            ProductionJournalLines: [
                {
                    ItemNo: smokingOutputItem,
                    Quantity: roundTo4Decimals(smokingOutputQuantity),
                    uom: smokingBOM[0].output_item_uom,
                    LocationCode: transfer_to_location,
                    BIN: '',
                    line_no: 1000,
                    type: 'output',
                    date_time: dateTime,
                    user,
                },
                ...smokingBOM.map((row, index) => ({
                    ItemNo: row.input_item,
                    Quantity: roundTo4Decimals(smokingOutputQuantity * parseFloat(row.input_item_qt_per) / parseFloat(smokingBOM[0].batch_size)),
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

        // Fetch BOM data for stuffing
        // console.log(smokingBOM)
        const mainStuffingItem =smokingBOM.filter(item => item.input_item.startsWith('G'))[0].input_item;
          
        // console.log(mainStuffingItem)

        if (!mainStuffingItem) {
            logger.error(`No main intake item starting with "G" found in the smoking BOM for output_item: ${product_code}`);
            return [];
        }
        const stuffingBOM = await fetchBOMData('Stuffing', mainStuffingItem);
        // console.log(stuffingBOM);
        if (!stuffingBOM.length) {
            logger.error(`No stuffing BOM data found for output_item: ${mainStuffingItem}`);
            return [];
        }

        const stuffingOutputQuantity = smokingOutputQuantity;
        const uniqueStuffingBOM = stuffingBOM.reduce((acc, row) => {
            if (!acc.some(item => item.input_item === row.input_item)) {
                acc.push(row);
            }
            return acc;
        }, []);

        // Generate the stuffing production order
        const stuffingOrder = {
            production_order_no: `${stuffingBOM[0].recipe}_${id}`,
            ItemNo: mainStuffingItem,
            Quantity: roundTo4Decimals(stuffingOutputQuantity),
            uom: stuffingBOM[0].output_item_uom,
            LocationCode: transfer_from_location,
            BIN: '',
            user,
            line_no: 1000,
            routing: 'continentals',
            date_time: dateTime,
            ProductionJournalLines: [
                {
                    ItemNo: mainStuffingItem,
                    Quantity: roundTo4Decimals(stuffingOutputQuantity),
                    uom: stuffingBOM[0].output_item_uom,
                    LocationCode: transfer_from_location,
                    BIN: '',
                    line_no: 1000,
                    type: 'output',
                    date_time: dateTime,
                    user,
                },
                ...uniqueStuffingBOM.map((row, index) => ({
                    ItemNo: row.input_item,
                    Quantity: roundTo4Decimals(stuffingOutputQuantity * parseFloat(row.input_item_qt_per) / parseFloat(uniqueStuffingBOM[0].batch_size)),
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

        return [stuffingOrder,smokingOrder,packingOrder];
    } catch (error) {
        logger.error(`Error generating production orders: ${error.message}`);
        return [];
    }
};


// Example usage
// const jsonData = `{"product_code":"J31031702","transfer_from_location":"2595","transfer_to_location":"3535","receiver_total_pieces":"797","receiver_total_weight":"797","received_by":68,"production_date":null,"with_variance":"1","timestamp":"2024-11-18 19:34:00","company_name":"FCL"}`;

// (async () => {
//     try {
//         const data = await transformData(JSON.parse(jsonData));
//         console.log(JSON.stringify(data, null, 2)); // Pretty-print the output
//     } catch (error) {
//         logger.error('Error:', error.message);
//     }
// })();
