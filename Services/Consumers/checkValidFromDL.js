import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js';
import dayjs from 'dayjs';

export const cleanUp = async () => {
    const dlQueueName = 'production_data_order_deboning.bc.dl'; // DL Queue name
    const dlExchange = 'fcl.exchange.dlx';
    const mainExchange = 'fcl.exchange.direct';
    const routingKey = 'production_data_order_deboning.bc';
    const dateThreshold = dayjs('2024-12-16'); // 16th Dec 2024

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        // Assert DL queue
        await channel.assertExchange(dlExchange, 'direct', { durable: true });
        await channel.assertQueue(dlQueueName, { durable: true });
        await channel.bindQueue(dlQueueName, dlExchange, routingKey);

        // Prefetch one message at a time
        channel.prefetch(1);
        logger.info(`Waiting for messages in DL queue: ${dlQueueName}`);

        channel.consume(
            dlQueueName,
            async (msg) => {
                if (msg !== null) {
                    try {
                        const messageData = JSON.parse(msg.content.toString());
                        logger.info(`Received message: ${JSON.stringify(messageData)}`);

                        const { timestamp } = messageData;

                        if (timestamp && dayjs(timestamp).isAfter(dateThreshold)) {
                            // Republishing message to main exchange
                            await channel.publish(
                                mainExchange,
                                routingKey,
                                Buffer.from(JSON.stringify(messageData)),
                                { persistent: true } // Ensures message durability
                            );
                            logger.info(
                                `Message republished to main queue: ${JSON.stringify(messageData)}`
                            );

                            channel.ack(msg); // Acknowledge the message
                        } else {
                            logger.warn(
                                `Message acknowledged but not republished due to invalid timestamp: ${JSON.stringify(messageData)}`
                            );
                            channel.ack(msg); // Acknowledge message without republishing
                        }
                    } catch (error) {
                        logger.error(`Error processing message: ${error.message}`);
                        channel.ack(msg); // Acknowledge to avoid requeueing
                    }
                }
            },
            { noAck: false }
        );
    } catch (error) {
        logger.error(`Error consuming DL queue: ${error.message}`);
        throw error;
    }
};

await cleanUp();
