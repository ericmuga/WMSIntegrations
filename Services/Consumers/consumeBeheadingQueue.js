import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up
import { transformData } from '../Transformers/transformer.js';



export const consumeBeheadingData = async () => {
    const queueName = 'production_data_order_beheading.bc';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'production_data_order_beheading.bc';
    const batchSize = 50;

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        await channel.assertExchange(exchange, 'direct', { durable: true });
        await channel.assertQueue(queueName, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': 'fcl.exchange.dlx',
                'x-dead-letter-routing-key': routingKey,
            },
        });
        await channel.bindQueue(queueName, exchange, routingKey);

        channel.prefetch(batchSize);

        const messages = [];

        await new Promise((resolve) => {
            channel.consume(
                queueName,
                (msg) => {
                    if (msg) {
                        try {
                            const data = JSON.parse(msg.content.toString());
                            messages.push(transformData(data));
                        channel.ack(msg);

                            if (messages.length >= batchSize) {
                                resolve();
                            }
                        } catch (err) {
                            logger.error(`Error transforming message: ${err.message}`);
                            channel.nack(msg, false, false); // Move to dead-letter queue
                        }
                    }
                },
                { noAck: false }
            );

            // Timeout for consuming messages
            setTimeout(() => {
                logger.info(`Timeout reached for queue: ${queueName}, resolving with ${messages.length} messages.`);
                resolve();
            }, 5000); // 5 seconds
        });

        await channel.close();

        if (messages.length === 0) {
            logger.info(`No messages processed from queue: ${queueName}`);
        }

        return messages;
    } catch (error) {
        logger.error(`Error consuming data: ${error.message}`);
        throw error;
    }
};
