import { fetchBOMData,
    generateMixtureOrders,
    getMainIntakeItem,
    cleanProductionOrders,
    fetchMixtureItems,
    constructProductionOrder,
  } from '../Utils/utilities.js';
import logger from '../../logger.js';

/**
* Processes a sequence of production steps and generates production orders.
* Evaluates the final process but does not process anything after it.
* @param {Object} params - Parameters for processing.
* @returns {Array} - Array of cleaned production orders.
*/
export const processSequenceHandler = async ({
initialItem,
batchMultiplier,
user,
dateTime,
id,
finalProcess, // New parameter to indicate the last process to evaluate
}) => {
let currentItem = initialItem;
const productionOrders = [];
const excludedItems = await fetchMixtureItems();
let previousOutputQuantity = null;

while (currentItem) {
   // Fetch BOM data for the current output item
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
   let qty;
   for (const line of processBOM) {
       if (excludedItems.has(line.input_item)) {
           const mixtureProcess = (await fetchBOMData(null, line.input_item))[0]?.Process?.trim();
           if (mixtureProcess) {
            qty= productionOrder.ProductionJournalLines.find(
                (item) => item.type === 'consumption' && item.ItemNo === line.input_item
            )?.Quantity;
               await generateMixtureOrders(line, mixtureProcess, dateTime, user, productionOrders, qty);
           }
       }
   }

   logger.debug(`Created order: ${JSON.stringify(productionOrder, null, 2)}`);

   // Check if the current process is the final process
   if (currentProcess === finalProcess) {
       logger.info(`Final process (${finalProcess}) evaluated. Stopping further processing.`);
       break;
   }

   // Set the next item to process
   currentItem = mainIntakeItem.input_item;
}

return cleanProductionOrders(productionOrders);
};
