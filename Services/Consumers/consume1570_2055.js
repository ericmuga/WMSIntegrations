import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up
import { transformData } from '../Transformers/Transform_1570_to2055.js';

export const consume1570_2055 = async () => {
    const queueName = 'transfer_from_1570_to_2055';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'transfer_from_1570_to_2055';
    const batchSize = 10; // Set batch size here
    const timeout = 2000; // Timeout in milliseconds (e.g., 2 seconds)

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

        await channel.assertExchange(exchange, 'direct', { durable: true });
        await channel.assertQueue(queueName, queueOptions);
        await channel.bindQueue(queueName, exchange, routingKey);

        channel.prefetch(batchSize);

        logger.info(`Waiting for up to ${batchSize} messages in queue: ${queueName}`);

        const messages = [];

        // Handle batching and timeout logic
        await new Promise((resolve) => {
            channel.consume(
                queueName,
                (msg) => {
                    if (msg) {
                        try {
                            const transferData = JSON.parse(msg.content.toString());
                            logger.info(`Received transfer data: ${JSON.stringify(transferData)}`);

                            const transformedData = transformData(transferData);

                            if (transformedData && transformedData.length > 0) {
                                messages.push(...transformedData); // Spread to add all transformed results
                                channel.ack(msg); // Acknowledge the message
                            } else {
                                logger.warn(`Transformer returned null or empty array for message: ${JSON.stringify(transferData)}`);
                                channel.nack(msg, false, false); // Move to dead-letter queue
                                resolve([]); // Resolve with an empty array
                            }

                            // Resolve batch if filled
                            if (messages.length >= batchSize) {
                                resolve();
                            }
                        } catch (error) {
                            logger.error(`Failed to parse message content: ${error.message}`);
                            channel.nack(msg, false, false); // Move to dead-letter queue
                            resolve([]); // Resolve with an empty array
                        }
                    }
                },
                { noAck: false }
            );

            // Resolve after timeout if no messages or partial batch
            setTimeout(() => {
                logger.info(`Timeout reached, resolving with ${messages.length} collected messages`);
                resolve();
            }, timeout);
        });

        await channel.close();

        return messages.flat(); // Return the flat array of messages
    } catch (error) {
        logger.error(`Error consuming transfer data from RabbitMQ: ${error.message}`);
        throw error;
    }
};

// Example usage
// (async () => {
//     try {
//         const data = await consume1570_2055();
//         console.log(JSON.stringify(data, null, 2)); // Pretty-print the output
//     } catch (error) {
//         console.error('Error processing transfer data:', error.message);
//     }
// })();
