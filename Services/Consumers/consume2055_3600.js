import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js';
import { transformData } from '../Transformers/transform2055_to_3535_3600.js';

export const consume2055_3600 = async () => {
    const queueName = 'transfer_from_2055_to_3600';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'transfer_from_2055_to_3600';
    const batchSize = 1; // Process one message at a time
    const timeout = 3000; // Timeout in milliseconds

    const queueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'fcl.exchange.dlx',
            'x-dead-letter-routing-key': routingKey,
        },
    };

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        // Set up RabbitMQ queue and exchange
        await channel.assertExchange(exchange, 'direct', { durable: true });
        await channel.assertQueue(queueName, queueOptions);
        await channel.bindQueue(queueName, exchange, routingKey);
        channel.prefetch(batchSize);

        logger.info(`Waiting for up to ${batchSize} messages in queue: ${queueName}`);

        const messages = [];
        let batchResolve;

        // Batch promise for processing messages
        const batchPromise = new Promise((resolve) => {
            batchResolve = resolve;
        });

        // Timeout to finalize processing if no new messages arrive
        const batchTimeout = setTimeout(() => {
            logger.info(`Timeout reached with ${messages.length} messages collected.`);
            batchResolve(messages);
        }, timeout);

        // Start consuming messages
        channel.consume(
            queueName,
            async (msg) => {
                if (!msg) {
                    logger.warn('Received null message');
                    return;
                }

                try {
                    const transferData = JSON.parse(msg.content.toString());
                    logger.info(`Received transfer data: ${JSON.stringify(transferData)}`);

                    try {
                        const transformedData = await transformData(transferData);

                        if (transformedData && transformedData.length > 0) {
                            messages.push(...transformedData); // Add transformed results
                            // channel.ack(msg); // Acknowledge the message
                        } else {
                            logger.warn(`Transformer returned empty data for: ${JSON.stringify(transferData)}`);
                            channel.nack(msg, false, false); // Send to dead-letter queue
                        }

                        // Resolve the batch if filled
                        if (messages.length >= batchSize) {
                            clearTimeout(batchTimeout); // Clear timeout for completed batch
                            batchResolve(messages);
                        }
                    } catch (transformError) {
                        logger.error(`Transformation error: ${transformError.message}`);
                        channel.nack(msg, false, false); // Send to dead-letter queue
                    }
                } catch (parseError) {
                    logger.error(`Message parse error: ${parseError.message}`);
                    channel.nack(msg, false, false); // Send to dead-letter queue
                }
            },
            { noAck: false }
        );

        // Wait for the batch to be filled or timeout
        const batch = await batchPromise;

        // Cleanup
        await channel.close();
        logger.info(`Processed ${batch.length} messages from queue: ${queueName}`);
        return batch; // Return the processed messages
    } catch (error) {
        logger.error(`Error consuming messages from RabbitMQ: ${error.message}`);
        throw error;
    }
};

// Example usage
// (async () => {
//     try {
//         const data = await consume2055_3600();
//         console.log(JSON.stringify(data, null, 2)); // Pretty-print the output
//     } catch (error) {
//         console.error(`Error: ${error.message}`);
//     }
// })();
