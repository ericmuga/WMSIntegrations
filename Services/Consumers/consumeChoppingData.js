import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up
import { transformData } from '../Transformers/choppingTransformer.js';

export const consumechoppingData = async () => {
    const queueName = 'production_data_order_chopping.bc';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'production_data_order_chopping.bc';
    const batchSize = 1; // Number of messages to process at once

    let connection, channel;
    const messages = [];

    try {
        connection = await getRabbitMQConnection();
        channel = await connection.createChannel();

        // Assert the exchange and queue
        await channel.assertExchange(exchange, 'direct', { durable: true });
        await channel.assertQueue(queueName, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': 'fcl.exchange.dlx',
                'x-dead-letter-routing-key': routingKey,
            },
        });
        await channel.bindQueue(queueName, exchange, routingKey);

        channel.prefetch(batchSize); // Control message flow

        logger.info(`Consuming from queue: ${queueName}`);

        await new Promise((resolve, reject) => {
            const stopConsumption = () => {
                logger.info(`Finished consuming from queue: ${queueName}`);
                resolve();
            };

            channel.consume(
                queueName,
                async (msg) => {
                    if (msg) {
                        try {
                            const data = JSON.parse(msg.content.toString());
                            const transformedData = await transformData(data);
                            messages.push(transformedData);

                            channel.ack(msg); // Acknowledge the message

                            if (messages.length >= batchSize) {
                                stopConsumption(); // Stop consuming after batch
                            }
                        } catch (error) {
                            logger.error(`Error transforming message: ${error.message}`);
                            channel.nack(msg, false, false); // Reject message without requeuing
                            return [];
                        }
                    } else {
                        stopConsumption(); // Stop if no message is received
                    }
                },
                { noAck: false }
            );
        });

        return messages; // Return the processed messages
    } catch (error) {
        logger.error(`Error consuming data from RabbitMQ: ${error.message}`);
        throw error;
    } finally {
        if (channel) await channel.close();
        // if (connection) await connection.close();
    }
};

