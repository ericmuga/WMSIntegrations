import { getRabbitMQConnection } from '../../config/default.js';
import { transformData } from '../Transformers/choppingTransformer.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up

export const consumechoppingData = async () => {
    const queueName = 'production_data_order_chopping.bc';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'production_data_order_chopping.bc';
    const batchSize = 1;
    const timeout = 5000; // Timeout in milliseconds (e.g., 5 seconds)
    const queueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'fcl.exchange.dlx',
            'x-dead-letter-routing-key': 'production_data_order_chopping.bc',
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
                        const choppingData = JSON.parse(msg.content.toString());
                        logger.info(`Received chopping data: ${JSON.stringify(choppingData)}`);
                        messages.push(transformData(choppingData)); // Transform each message data
                        logger.info(`${JSON.stringify(messages)}`);
                        // channel.ack(msg);

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

        // Return the flattened array of objects
        return flattenedData.flat(); // Ensures no additional nesting
    } catch (error) {
        logger.error('Error consuming chopping data from RabbitMQ: ' + error.message);
        throw error;
    }
};

(async () => {
    try {
        const data = await consumechoppingData();
        logger.info(JSON.stringify(data, null, 2)); // Pretty-print the output
    } catch (error) {
        console.error('Error processing chopping data:', error.message);
    }
})();
