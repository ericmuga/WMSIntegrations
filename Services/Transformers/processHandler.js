
import { fetchBOMData } from '../Utils/utilities.js';
import { constructProductionOrder } from '../Utils/productionOrderHelper.js';
import logger from '../../logger.js';

/**
 * Cleans and validates the JSON data.
 * 
 * @param {Array} productionOrders - The array of production orders to clean.
 * @returns {Array} - The cleaned production orders.
 */
export const cleanProductionOrders = (productionOrders) => {
    return productionOrders.map((order) => {
        const { ProductionJournalLines } = order;

        // Remove duplicate lines
        const uniqueLines = [];
        const seenLines = new Set();

        ProductionJournalLines.forEach((line) => {
            const lineKey = `${line.ItemNo}_${line.line_no}_${line.type}`;
            if (!seenLines.has(lineKey)) {
                seenLines.add(lineKey);
                uniqueLines.push(line);
            }
        });

        return {
            ...order,
            ProductionJournalLines: uniqueLines,
        };
    });
};


export const processSequenceHandler = async ({
    sequence,
    initialItem,
    batchMultiplier,
    user,
    dateTime,
    id,
}) => {
    let currentItem = initialItem;
    const productionOrders = [];

    for (const process of sequence) {
        // Fetch BOM data for the current process
        const currentBOM = await fetchBOMData(process, currentItem);
        // console.log(currentBOM);
        if (!currentBOM.length) {
            logger.error(`No BOM data found for process: ${process} and item: ${currentItem}`);
            return [];
        }

        // Find the next main intake item (starts with 'G')
        const mainIntakeItem = currentBOM.find((row) => row.input_item && row.input_item.startsWith('G'));
        if (!mainIntakeItem) {
            logger.error(`No main intake item starting with "G" found in the BOM for process: ${process} and item: ${currentItem}`);
            return [];
        }

        const outputQuantity = batchMultiplier * parseFloat(mainIntakeItem.input_item_qt_per);

        // Construct the production order for the current process
        const productionOrder = constructProductionOrder({
            recipe: currentBOM[0].recipe,
            outputItem: currentItem,
            outputQuantity,
            uom: currentBOM[0].output_item_uom,
            BOM: currentBOM,
            user,
            dateTime,
            productionType: id,
        });

        productionOrders.push(productionOrder);

        // Set currentItem to the next main intake item for the next process
        currentItem = mainIntakeItem.input_item;
    }

    return cleanProductionOrders(productionOrders);
};
