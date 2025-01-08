import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up
import { transformData } from '../Transformers/breakingTransformer.js';

export const consumeBreakingData = async () => {
    const queueName = 'production_data_order_breaking.bc';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'production_data_order_breaking.bc';
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

        await new Promise((resolve) => {
            channel.consume(
                queueName,
                (msg) => {
                    if (msg) {
                        try {
                            const breakingData = JSON.parse(msg.content.toString());
                            logger.info(`Received breaking data: ${JSON.stringify(breakingData)}`);
                            messages.push(transformData(breakingData)); // Transform and store the data
                            channel.ack(msg);

                            if (messages.length >= batchSize) {
                                resolve();
                            }
                        } catch (err) {
                            logger.error(`Failed to parse message content: ${err.message}`);
                            channel.nack(msg, false, false);
                        }
                    }
                },
                { noAck: false }
            );

            setTimeout(() => {
                resolve();
            }, timeout); // Resolve after timeout if no messages or batch not filled
        });

        await channel.close();
        return messages;
    } catch (error) {
        logger.error(`Error consuming breaking data: ${error.message}`);
        throw error;
    }
};
