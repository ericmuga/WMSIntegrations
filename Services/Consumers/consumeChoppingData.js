import { getRabbitMQConnection } from '../../config/default.js';
import { transformData } from '../Transformers/choppingTransformer.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up

export const consumechoppingData = async () => {
    const queueName = 'production_data_order_chopping.bc';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'production_data_order_chopping.bc';
    const batchSize = 1; // Process one message at a time
    const timeout = 4000; // Timeout in milliseconds (e.g., 4 seconds)

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

        logger.info(`Waiting for up to ${batchSize} message(s) in queue: ${queueName}`);

        const messages = [];

        // Promise to handle batch processing
        await new Promise((resolve) => {
            channel.consume(
                queueName,
                async (msg) => {
                    if (msg) {
                        try {
                            const choppingData = JSON.parse(msg.content.toString());
                            logger.info(`Received chopping data: ${JSON.stringify(choppingData)}`);

                            const transformedData = await transformData(choppingData);

                            if (transformedData) {
                                messages.push(transformedData);
                                channel.ack(msg);

                                if (messages.length >= batchSize) {
                                    resolve(); // Resolve when batch size is met
                                }
                            } else {
                                logger.warn('Transformation returned null or undefined data.');
                                channel.nack(msg, false, false); // Send to dead-letter queue
                            }
                        } catch (error) {
                            logger.error(`Failed to process message: ${error.message}`);
                            channel.nack(msg, false, false); // Send to dead-letter queue
                        }
                    }
                },
                { noAck: false }
            );

            setTimeout(() => resolve(), timeout); // Resolve after timeout
        });

        await channel.close();

        return messages.flat(); // Return flattened messages array
    } catch (error) {
        logger.error(`Error consuming chopping data: ${error.message}`);
        throw error;
    }
};

// Example usage
// (async () => {
//     try {
//         const data = await consumechoppingData();
//         logger.info(JSON.stringify(data, null, 2)); // Pretty-print the output
//     } catch (error) {
//         console.error('Error processing chopping data:', error.message);
//     }
// })();
