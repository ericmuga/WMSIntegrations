import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up
import { transformData } from '../Transformers/transformCarcassSales.js';

export const consumeCarcassSales = async () => {
    const queueName = 'production_sales_transfers.bc';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'production_sales_transfers.bc';
    const batchSize = 60; // Set the desired batch size
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
                            const salesData = JSON.parse(msg.content.toString());
                            logger.info(`Received sales data: ${JSON.stringify(salesData)}`);

                            const transformedData = transformData(salesData);

                            if (transformedData) {
                                messages.push(transformedData);
                                channel.ack(msg);

                                if (messages.length >= batchSize) {
                                    resolve(); // Resolve when batch size is met
                                }
                            } else {
                                logger.warn('Transformer returned null or undefined data.');
                                channel.nack(msg, false, false); // Dead-letter the message
                            }
                        } catch (error) {
                            logger.error(`Failed to process message: ${error.message}`);
                            channel.nack(msg, false, false); // Dead-letter the message
                        }
                    }
                },
                { noAck: false }
            );

            // Timeout to resolve if no messages are received
            setTimeout(() => resolve(), timeout);
        });

        await channel.close();

        return messages.flat(); // Flatten nested arrays if necessary
    } catch (error) {
        logger.error(`Error consuming sales data: ${error.message}`);
        throw error;
    }
};

// Example usage
// (async () => {
//     try {
//         const data = await consumeCarcassSales();
//         console.log(JSON.stringify(data, null, 2)); // Pretty-print the output
//     } catch (error) {
//         console.error('Error processing sales data:', error.message);
//     }
// })();
