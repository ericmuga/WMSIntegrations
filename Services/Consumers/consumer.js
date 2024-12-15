import { getRabbitMQConnection, rabbitmqConfig } from '../../config/default.js';
import logger from '../../logger.js';
import { transformData } from '../Transformers/transformData.js';


/**
 * Generic RabbitMQ Consumer
 * 
 * @param {Object} options - Consumer options.
 * @param {string} options.queueName - The name of the queue to consume from.
 * @param {string} options.routingKey - The routing key for the queue.
 * @param {Array} options.sequence - The sequence of processes for transforming data.
 * @param {number} [options.batchSize] - The number of messages to process in a batch.
 * @param {number} [options.timeout] - The timeout in milliseconds for batch processing.
 */
export const consumeRabbitMQ = async ({
    queueName,
    routingKey,
    sequence,
    batchSize = rabbitmqConfig.defaultBatchSize,
    timeout = rabbitmqConfig.defaultTimeout,
}) => {
    const exchange = rabbitmqConfig.defaultExchange;
    const queueOptions = {
        durable: true,
        arguments: {
            ...rabbitmqConfig.queueArguments,
            'x-dead-letter-routing-key': queueName 
        },
    };

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        await channel.assertExchange(exchange, 'direct', { durable: true });
        await channel.assertQueue(queueName, queueOptions);
        await channel.bindQueue(queueName, exchange, routingKey);

        // Prefetch to limit the number of unacknowledged messages delivered
        channel.prefetch(batchSize);

        // logger.info(`Waiting for up to ${batchSize} messages in queue: ${queueName}`);

        const messages = [];
        let batchResolve;
        let batchTimeout;

        // Batch promise to return the messages array
        const batchPromise = new Promise((resolve) => {
            batchResolve = resolve;
        });

        // Set a timeout to resolve with the collected messages
        batchTimeout = setTimeout(() => {
            if (messages.length > 0) {
                logger.info('Timeout reached, resolving with partial batch');
                batchResolve(messages);
            }
        }, timeout);

        // Start consuming messages
        channel.consume(
            queueName,
            async (msg) => {
                if (msg !== null) {
                    try {
                        const transferData = JSON.parse(msg.content.toString());
                         logger.info(`Received transfer data:queueName ${queueName}`);
                        // logger.info(`Received transfer data: ${JSON.stringify(transferData,null,2)}`);

                        try {
                            // Transform the data using the provided sequence
                            const transformedData = await transformData(transferData, sequence);

                            if (transformedData && transformedData.length > 0) {
                                messages.push(...transformedData); // Spread to add all transformed results
                                // channel.ack(msg); // Acknowledge the message
                                
                            } else {
                                logger.warn(`Transformer returned null or empty array for message: ${JSON.stringify(transferData)}`);
                                channel.nack(msg, false, false); // Move to dead-letter queue
                            }

                            // Resolve batch if filled
                            if (messages.length >= batchSize) {
                                clearTimeout(batchTimeout); // Clear timeout if batch is filled
                                batchResolve(messages);
                            }
                        } catch (transformError) {
                            logger.error(`Error transforming data: ${transformError.message}`);
                            channel.nack(msg, false, false); // Move to dead-letter queue
                        }
                    } catch (parseError) {
                        logger.error(`Failed to parse message content: ${parseError.message}`);
                        channel.nack(msg, false, false); // Move to dead-letter queue
                    }
                } else {
                    logger.warn('Received null message');
                }
            },
            { noAck: false }
        );

        // Wait for the batch to be filled or timeout
        const batch = await batchPromise;
           console.log('batch',JSON.stringify(batch,null,2));
        logger.info(`Processd ${batch.length} orders from queue: ${queueName}`);

        // Cleanup and close the channel
        await channel.close();
        return batch; // Return the flat array of messages
    } catch (error) {
        logger.error('Error consuming messages from RabbitMQ: ' + error.message);
        throw error;
    }
};
