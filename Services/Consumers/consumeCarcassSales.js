import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up
import { transformData } from '../Transformers/transformCarcassSales.js';

export const consumeCarcassSales = async () => {
    const queueName = 'production_sales_transfers.bc';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'production_sales_transfers.bc';
    const batchSize = 5; // Set the desired batch size
    const timeout = 2000; // Timeout in milliseconds (e.g., 5 seconds)

    const queueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'fcl.exchange.dlx',
            'x-dead-letter-routing-key': 'production_sales_transfers.bc',
        },
    };

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        await channel.assertExchange(exchange, 'direct', { durable: true });
        await channel.assertQueue(queueName, queueOptions);
        await channel.bindQueue(queueName, exchange, routingKey);

        // Set prefetch to limit the number of unacknowledged messages delivered
        channel.prefetch(batchSize);

        const messages = [];
        let batchResolve;
        let batchTimeout;

        logger.info(`Waiting for up to ${batchSize} messages in queue: ${queueName}`);

        // Batch promise to return the messages array
        const batchPromise = new Promise((resolve) => {
            batchResolve = resolve;
        });

        // Set a timeout to resolve with an empty array if no messages are received
        batchTimeout = setTimeout(() => {
            if (messages.length === 0) {
                logger.info('No messages received within the timeout period');
                batchResolve([]); // Resolve with an empty array
            }
        }, timeout);

        // Start consuming messages
        channel.consume(
            queueName,
            (msg) => {
                if (msg !== null) {
                    try {
                        const salesData = JSON.parse(msg.content.toString());
                        logger.info(`Received sales data: ${JSON.stringify(salesData)}`);

                        const transformedData = transformData(salesData);

                        if (transformedData) {
                            messages.push(transformedData); // Add transformed message data
                            channel.ack(msg); // Acknowledge the message

                            if (messages.length >= batchSize) {
                                clearTimeout(batchTimeout); // Clear the timeout if the batch is filled
                                batchResolve(messages);
                            }
                        } else {
                            logger.warn(`Transformer returned null or undefined for message: ${JSON.stringify(salesData)}`);
                            channel.nack(msg, false, false); // Move to dead-letter queue
                        }
                    } catch (parseError) {
                        logger.error(`Failed to parse message content: ${parseError.message}`);
                        channel.nack(msg, false, false); // Move to dead-letter queue
                    }
                } else {
                    logger.warn("Received null message");
                }
            },
            { noAck: false }
        );

        // Wait for the batch to be filled or timeout
        const result = await batchPromise;

        // Cleanup and close the channel
        await channel.close();

        return result; // Return the messages array
    } catch (error) {
        logger.error('Error consuming sales data from RabbitMQ: ' + error.message);
        throw error;
    }
};

// Example usage
// (async () => {
//     const data = await consumeCarcassSales();
//     console.log(JSON.stringify(data, null, 2)); // Pretty-print the output
// })();
