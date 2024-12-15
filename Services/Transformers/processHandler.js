import { fetchBOMData,
         generateMixtureOrders,
         getMainIntakeItem,
         cleanProductionOrders,
         fetchMixtureItems,
         constructProductionOrder,
         SALTING_PROCESS,
         MBSOLUTION_PROCESS, 
       } from '../Utils/utilities.js';


import logger from '../../logger.js';


/**
 * Processes a sequence of production steps and generates production orders.
 * @param {Object} params - Parameters for processing.
 * @returns {Array} - Array of cleaned production orders.
 */



export const processSequenceHandler = async ({
    initialItem,
    batchMultiplier,
    user,
    dateTime,
    id,
}) => {
    let currentItem = initialItem;
    const productionOrders = [];
    const excludedItems = await fetchMixtureItems();
    let previousOutputQuantity = null;

    while (currentItem) {
        const processBOM = await fetchBOMData(null, currentItem);
        if (!processBOM.length) {
            logger.error(`No BOM data found for output_item: ${currentItem}`);
            break;
        }

        const currentProcess = processBOM[0].Process;
        logger.info(`Processing: ${currentItem} under process: ${currentProcess}`);

        const mainIntakeItem = getMainIntakeItem(processBOM, excludedItems);
        if (!mainIntakeItem) {
            logger.error(`No valid intake item for ${currentItem} in process: ${currentProcess}`);
            break;
        }

        const outputQuantity = currentItem === initialItem
            ? batchMultiplier * parseFloat(processBOM[0].batch_size)
            : previousOutputQuantity || 0;

        const productionOrder = constructProductionOrder({
            recipe: processBOM[0].recipe,
            outputItem: currentItem,
            outputQuantity,
            uom: processBOM[0].output_item_uom,
            BOM: processBOM,
            user,
            dateTime,
            id,
        });

        productionOrders.push(productionOrder);

        previousOutputQuantity = productionOrder.ProductionJournalLines.find(
            (line) => line.type === 'consumption' && line.ItemNo === mainIntakeItem.input_item
        )?.Quantity;

        for (const line of processBOM) {
            if (excludedItems.has(line.input_item)) {
                const mixtureProcess = (await fetchBOMData(null, line.input_item))[0]?.Process?.trim();
                if (mixtureProcess) {
                    await generateMixtureOrders(line, mixtureProcess, dateTime, user, productionOrders, previousOutputQuantity || 0);
                }
            }
        }

        logger.debug(`Created order: ${JSON.stringify(productionOrder, null, 2)}`);
        currentItem = mainIntakeItem.input_item;
    }

    return cleanProductionOrders(productionOrders);
};



