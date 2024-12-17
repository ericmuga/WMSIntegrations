import {
    fetchBOMData,
    generateMixtureOrders,
    getMainIntakeItem,
    cleanProductionOrders,
    fetchMixtureItems,
    constructProductionOrder,
    createSpecialProductionOrder,
    SPECIAL_ITEMS,
    logProcessBOM
} from '../Utils/utilities.js';
import logger from '../../logger.js';

/**
 * Processes a sequence of production steps and generates production orders.
 * Includes special orders for the final process and stops further processing.
 * @param {Object} params - Parameters for processing.
 * @returns {Array} - Array of cleaned production orders.
 */
export const processSequenceHandler = async ({
    initialItem,
    batchMultiplier,
    user,
    dateTime,
    id,
    finalProcess, // The last process to evaluate
}) => {
    let currentItem = initialItem;
    const productionOrders = [];
    const excludedItems = await fetchMixtureItems();
    let previousOutputQuantity = null;

    while (currentItem) {
        // Fetch BOM data for the current output item
       
        //log process BOM and item to DBTable for tracking

        const processBOM = await fetchBOMData(null, currentItem);

        if (!processBOM.length) {
            logger.error(`No BOM data found for output_item: ${currentItem}`);
            await logProcessBOM({
                fg: initialItem,
                process: 'Error',
                item: currentItem,
                qtyPer: 0,
                loss: 0,
                batchSize: 0,
            });
            break;
        }

        const currentProcess = processBOM[0].Process;
        const mainIntakeItem = getMainIntakeItem(processBOM, excludedItems);
        if (!mainIntakeItem) {
            logger.error(`No valid intake item for ${currentItem} in process: ${currentProcess}`);
            break;
        }

        const outputQuantity = currentItem === initialItem
            ? batchMultiplier * parseFloat(processBOM[0].batch_size)
            : previousOutputQuantity || 0;

        // Log BOM and item data to the database
        await logProcessBOM({
            fg: initialItem,
            process: currentProcess,
            item: currentItem,
            qtyPer: processBOM[0].input_item_qt_per,
            loss: processBOM[0].loss || 0,
            batchSize: processBOM[0].batch_size,
        });


        // const processBOM = await fetchBOMData(null, currentItem);
        // if (!processBOM.length) {
        //     logger.error(`No BOM data found for output_item: ${currentItem}`);
        //     break;
        // }
  
        

        // const currentProcess = processBOM[0].Process;
        // logger.info(`Processing: ${currentItem} under process: ${currentProcess}`);

        // const mainIntakeItem = getMainIntakeItem(processBOM, excludedItems);
        // if (!mainIntakeItem) {
        //     logger.error(`No valid intake item for ${currentItem} in process: ${currentProcess}`);
        //     break;
        // }

        // const outputQuantity = currentItem === initialItem
        //     ? batchMultiplier * parseFloat(processBOM[0].batch_size)
        //     : previousOutputQuantity || 0;

        // Create the production order
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

        // Update the previous output quantity
        previousOutputQuantity = productionOrder.ProductionJournalLines.find(
            (line) => line.type === 'consumption' && line.ItemNo === mainIntakeItem.input_item
        )?.Quantity;

        // Handle excluded items dynamically (e.g., items belonging to SALTING or MBSOLUTION)
        for (const line of processBOM) {
            if (excludedItems.has(line.input_item)) {
                const mixtureProcess = (await fetchBOMData(null, line.input_item))[0]?.Process?.trim();
                if (mixtureProcess) {
                    await generateMixtureOrders(line, mixtureProcess, dateTime, user, productionOrders, previousOutputQuantity || 0);
                }
            }
        }


       // Handle special items for the current process
            for (const line of processBOM) {
                if (SPECIAL_ITEMS.includes(line.input_item)) { // Use .includes if SPECIAL_ITEMS is an array
                    const specialOrder = createSpecialProductionOrder({
                        ItemNo: line.input_item,
                        Quantity: roundTo4Decimals(line.input_item_qt_per * outputQuantity), // Ensure proper rounding
                        uom: line.input_item_uom,
                        LocationCode: line.input_item_location || '',
                    }, dateTime, currentItem);

                    productionOrders.push(specialOrder);
                    logger.info(`Special order created for special item: ${line.input_item}`);
                }
            }

        // Check if the current process is the final process
        if (currentProcess === finalProcess) {
            logger.info(`Final process (${finalProcess}) evaluated with special orders. Stopping further processing.`);
            break;
        }

        // Set the next item to process
        currentItem = mainIntakeItem.input_item;
    }

    return cleanProductionOrders(productionOrders);
};
