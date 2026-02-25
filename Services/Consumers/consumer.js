import { getRabbitMQConnection, rabbitmqConfig } from '../../config/default.js';
import logger from '../../logger.js';
import { transformData } from '../Transformers/transformData.js';

/**
 * Consumes messages from a RabbitMQ queue with controlled processing.
 *
 * @param {Object} options - Consumer options.
 * @param {string} options.queueName - Name of the queue to consume messages from.
 * @param {string} options.routingKey - Routing key for the queue.
 * @param {number} [options.batchSize] - Number of messages to process in a batch.
 * @param {number} [options.timeout] - Timeout in milliseconds for batch processing.
 * @param {string} [options.finalProcess] - Final process name for transformation.
 * @returns {Promise<Array>} - Array of transformed messages.
 */
export const consumeRabbitMQ = async ({
    queueName,
    routingKey,
    batchSize = rabbitmqConfig.defaultBatchSize,
    timeout = rabbitmqConfig.defaultTimeout,
    finalProcess,
}) => {
    const exchange = rabbitmqConfig.defaultExchange;
    const queueOptions = {
        durable: true,
        arguments: {
            ...rabbitmqConfig.queueArguments,
            'x-dead-letter-routing-key': queueName,
        },
    };

    let connection;
    let channel;

    try {
        // Establish connection and channel
        connection = await getRabbitMQConnection();
        channel = await connection.createChannel();

        // Ensure exchange and queue exist
        await channel.assertExchange(exchange, 'direct', { durable: true });
        await channel.assertQueue(queueName, queueOptions);
        await channel.bindQueue(queueName, exchange, routingKey);

        // Set prefetch limit
        channel.prefetch(batchSize);
        logger.info(`Consuming messages from queue: ${queueName} with batch size: ${batchSize}`);

        const messages = [];
        let batchResolve;

        const batchPromise = new Promise((resolve) => {
            batchResolve = resolve;
        });

        const batchTimeout = setTimeout(() => {
            logger.info(`Timeout reached for ${queueName}, resolving batch with ${messages.length} messages.`);
            batchResolve(messages);
        }, timeout);

        // Consume messages
        channel.consume(
            queueName,
            async (msg) => {
                if (!msg) return;

                try {
                    const messageContent = JSON.parse(msg.content.toString());
                    logger.info(`Received message: ${JSON.stringify(messageContent)}`);

                    // Transform the data
                    const transformedData = await transformData(messageContent, finalProcess);

                    if (transformedData && transformedData.length > 0) {
                        messages.push(...transformedData);
                        logger.info(`Transformed data: ${JSON.stringify(transformedData)}`);

                        // Acknowledge the message only after processing
                        channel.ack(msg);

                        // Resolve the batch if the size is met
                        if (messages.length >= batchSize) {
                            clearTimeout(batchTimeout);
                            batchResolve(messages);
                        }
                    } else {
                        logger.warn(`No transformed data for message: ${JSON.stringify(messageContent)}`);
                        channel.nack(msg, false, false); // Send to dead-letter queue
                    }
                } catch (error) {
                    logger.error(`Error processing message: ${error.message}`);
                    channel.nack(msg, false, false);
                }
            },
            { noAck: false } // Ensure manual acknowledgment
        );

        // Wait for batch processing to complete
        const result = await batchPromise;
        return result;
    } catch (error) {
        logger.error(`Error in consumeRabbitMQ: ${error.message}`);
        throw error;
    } finally {
        logger.info(`Leaving the connection and channel open for queue: ${queueName}`);
        // Connections and channels are left open intentionally to allow further consumption.
    }
};
