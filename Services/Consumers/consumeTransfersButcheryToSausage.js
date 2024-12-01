import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up
import { transformData } from '../Transformers/mincingTransformer.js';

export const consumeButcheryToSausageTransfers = async () => {
    const queueName = 'transfer_from_1570_to_2055';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'transfer_from_1570_to_2055';
    const batchSize = 10; // Set batch size here
    const timeout = 5000; // Timeout in milliseconds (e.g., 5 seconds)

    const queueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'fcl.exchange.dlx',
            'x-dead-letter-routing-key': 'transfer_from_1570_to_2055',
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

        logger.info(`Waiting for up to ${batchSize} messages in queue: ${queueName}`);

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
            (msg) => {
                if (msg !== null) {
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
                        }


                        // Resolve batch if filled
                        if (messages.length >= batchSize) {
                            clearTimeout(batchTimeout); // Clear timeout if batch is filled
                            batchResolve(messages);
                        }
                    } catch (parseError) {
                        logger.error(`Failed to parse message content: ${parseError.message}`);
                        // channel.nack(msg, false, false); // Move to dead-letter queue
                    }
                } else {
                    logger.warn('Received null message');
                }
            },
            { noAck: false }
        );

        // Wait for the batch to be filled or timeout
        const batch = await batchPromise;

        // Cleanup and close the channel
        await channel.close();
        return batch; // Return the flat array of messages
    } catch (error) {
        logger.error('Error consuming transfer data from RabbitMQ: ' + error.message);
        throw error;
    }
};

// Example usage
// (async () => {
//     const data = await consumeButcheryToSausageTransfers();
//     console.log(JSON.stringify(data, null, 2)); // Pretty-print the output
// })();
