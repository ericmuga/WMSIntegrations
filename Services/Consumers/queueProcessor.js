import { consumeRabbitMQ } from './path/to/consumeRabbitMQ.js';
import { processConfig } from './path/to/processConfig.js';
import logger from './path/to/logger.js';

/**
 * Processes RabbitMQ messages and converts them into production orders.
 * 
 * @param {Object} options - Configuration options for processing.
 * @param {string} options.queueName - Name of the RabbitMQ queue.
 * @param {string} options.routingKey - Routing key for the queue.
 * @param {Array} options.sequence - Sequence of processes to handle.
 * @param {number} options.batchSize - Number of messages to process in a batch.
 * @param {number} options.timeout - Timeout for processing messages.
 * @returns {Promise<void>} - Resolves when processing is complete.
 */
export const processProductionOrders = async ({
    queueName = 'transfer_from_1570_to_3535',
    routingKey = 'transfer_from_1570_to_3535',
    sequence = processConfig.packing,
    batchSize = 5,
    timeout = 5000,
}) => {
    try {
        const productionOrders = await consumeRabbitMQ({
            queueName,
            routingKey,
            sequence,
            batchSize,
            timeout,
        });

        // logger.info('Processed Production Orders:', JSON.stringify(productionOrders, null, 2));
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
};
