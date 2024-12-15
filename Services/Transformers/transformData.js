import { fetchProcessForOutputItem, fetchBOMData } from '../Utils/utilities.js';
import { processSequenceHandler } from './processHandler.js';
import logger from '../../logger.js';
import {processConfig} from '../Consumers/processConfig.js';

/**
 * Transforms transfer data into production orders.
 *
 * @param {Object} transferData - The data for the transfer.
 * @param {Array} sequence - The sequence of processes to follow.
 * @returns {Array} - The generated production orders in reverse order.
 */
export const transformData = async (transferData, sequence) => {
    try {
        const {
            product_code,
            receiver_total_weight,
            id,
            timestamp,
        } = transferData;

        const dateTime = new Date(timestamp).toISOString();
        const user = 'wms_bc';

        // Dynamically resolve the Process for the initial product_code
        const initialProcess = await fetchProcessForOutputItem(product_code);
        if (!initialProcess) {
            logger.error(`No Process found for product_code: ${product_code}`);
            return [];
        }

        // Fetch BOM data for the initial Process
        const initialBOM = await fetchBOMData(initialProcess, product_code);
        if (!initialBOM.length) {
            logger.error(`No BOM data found for Process: ${initialProcess} and output_item: ${product_code}`);
            return [];
        }

        const batchMultiplier = receiver_total_weight / parseFloat(initialBOM[0].batch_size);
       

        // Process the sequence of operations
        const productionOrders = await processSequenceHandler({
            sequence,
            initialItem: product_code,
            batchMultiplier,
            user,
            dateTime,
            id,
        });

        // Reverse the order of production orders
        return productionOrders.reverse();
    } catch (error) {
        logger.error(`Error generating production orders: ${error.message}`);
        return [];
    }
};

// Example usage
const jsonData = ` {
  "product_code": "J31020612",
  "transfer_from_location": 2595,
  "transfer_to_location": "3535",
  "receiver_total_pieces": "250",
  "receiver_total_weight": "100",
  "received_by": 82,
  "production_date": "2024-12-03T21:00:00.000000Z",
  "timestamp": "2024-12-04 01:18:38",
  "id": 44,
  "company_name": "FCL"
}`;

(async () => {
    try {
        const data = await transformData(JSON.parse(jsonData));
        logger.info(`transfer: ${JSON.stringify(JSON.parse(jsonData), null, 2)}`); // Pretty-print the output
        logger.info(`Orders: ${JSON.stringify(data, null, 2)}`); // Pretty-print the output
        // logger.info(`Orders: ${JSON.stringify(data, null, 2)}`); // Pretty-print the output
    } catch (error) {
        logger.error('Error:', error.message);
    }
})();


