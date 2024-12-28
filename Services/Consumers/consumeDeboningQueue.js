import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up
import { transformData } from '../Transformers/transformSlicing.js';

export const consumeDeboningData = async () => {
    const queueName = 'production_data_order_deboning.bc';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'production_data_order_deboning.bc';
    const batchSize =10 ; // Set the desired batch size
    const timeout = 3000; // Timeout in milliseconds (e.g., 5 seconds)
    const queueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'fcl.exchange.dlx',
            'x-dead-letter-routing-key': 'production_data_order_deboning.bc',
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
        let batchResolve;
        let batchTimeout;

        // Batch promise to return the messages array
        const batchPromise = new Promise((resolve) => {
            batchResolve = resolve;
        });

        // Set a timeout to resolve with an empty array if no messages are received
        batchTimeout = setTimeout(() => {
            if (messages.length === 0) {
                logger.info('No messages received within the timeout period');
                batchResolve([]);
            }
        }, timeout);

        // Start consuming messages
        channel.consume(
            queueName,
            (msg) => {
                if (msg !== null) {
                    try {
                        const deboningData = JSON.parse(msg.content.toString());
                        logger.info(`Received deboning data: ${JSON.stringify(deboningData)}`);
                        messages.push(transformData(deboningData)); // Transform and add message data
                        channel.ack(msg);

                        // If batch size is reached, resolve the promise
                        if (messages.length >= batchSize) {
                            clearTimeout(batchTimeout); // Clear timeout if batch is filled
                            batchResolve(messages);
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

        // Flatten nested arrays of production orders
        const flattenProductionOrders = (nestedOrders) => {
            return nestedOrders.flat();
        };

        const flattenedData = flattenProductionOrders(batch);

        // Cleanup and close the channel
        await channel.close();

        // Return the flattened data
        return flattenedData;
    } catch (error) {
        logger.error('Error consuming deboning data from RabbitMQ: ' + error.message);
        throw error;
    }
};

// (async () => {
//     try {
//         const data = await consumeDeboningData();
//         console.log(JSON.stringify(data, null, 2)); // Pretty-print the output
//     } catch (error) {
//         console.error('Error processing deboning data:', error.message);
//     }
// })();
