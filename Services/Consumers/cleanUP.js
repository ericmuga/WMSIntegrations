import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js';
import dayjs from 'dayjs';

export const cleanUp = async () => {
    const mainQueueName = 'transfer_from_1570_to_3600';
    const mainExchange = 'fcl.exchange.direct';
    const dlExchange = 'fcl.exchange.dlx';
    const routingKey = 'transfer_from_1570_to_3600';
    const dateThreshold = dayjs('2024-12-04');

    const mainQueueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': dlExchange,
            'x-dead-letter-routing-key': routingKey,
        },
    };


    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        // Assert the main queue
        await channel.assertExchange(mainExchange, 'direct', { durable: true });
        await channel.assertQueue(mainQueueName, mainQueueOptions);
        await channel.bindQueue(mainQueueName, mainExchange, routingKey);

           channel.prefetch(1); // Process one message at a time
        logger.info(`Waiting for messages in queue: ${mainQueueName}`);

        channel.consume(
            mainQueueName,
            async (msg) => {
                if (msg !== null) {
                    try {
                        const messageData = JSON.parse(msg.content.toString());
                        logger.info(`Received data: ${JSON.stringify(messageData)}`);

                        const { id, timestamp, product_code } = messageData;

                        // Validate id and timestamp
                        const isInvalid =
                            !id || // No ID
                            !timestamp || // No timestamp
                            dayjs(timestamp).isBefore(dateThreshold); // Timestamp earlier than 4th Dec 2024

                        if (isInvalid) {
                            logger.warn(`Invalid message: ${JSON.stringify(messageData)}`);
                            channel.nack(msg, false, false); // Dead-letter the message
                            return;
                        }

                    } catch (error) {
                        logger.error(`Error processing message: ${error.message}`);
                        channel.nack(msg, false, false); // Dead-letter the message
                    }
                } else {
                    logger.warn('Received null message');
                }
            },
            { noAck: false }
        );
    } catch (error) {
        logger.error(`Error consuming and republishing data: ${error.message}`);
        throw error;
    }
};

await cleanUp();