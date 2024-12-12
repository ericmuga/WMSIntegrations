import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js';
import dayjs from 'dayjs';

export const consumeAndRepublishData = async () => {
    const mainQueueName = 'transfer_from_2595_to_3535';
    const mainExchange = 'fcl.exchange.direct';
    const dlExchange = 'fcl.exchange.dlx';
    const routingKey = 'transfer_from_2595_to_3535';
    const dateThreshold = dayjs('2024-12-04');

    const mainQueueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': dlExchange,
            'x-dead-letter-routing-key': routingKey,
        },
    };

    const baconQueueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': dlExchange,
            'x-dead-letter-routing-key': 'bacon.bc',
        },
    };

    const continentalsQueueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': dlExchange,
            'x-dead-letter-routing-key': 'continentals.bc',
        },
    };

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        // Assert the main queue
        await channel.assertExchange(mainExchange, 'direct', { durable: true });
        await channel.assertQueue(mainQueueName, mainQueueOptions);
        await channel.bindQueue(mainQueueName, mainExchange, routingKey);

        // Assert the target queues
        const baconQueueName = 'bacon.bc';
        const continentalsQueueName = 'continentals.bc';

        await channel.assertQueue(baconQueueName, baconQueueOptions);
        logger.info(`Queue ${baconQueueName} is ready with options: ${JSON.stringify(baconQueueOptions)}`);

        await channel.assertQueue(continentalsQueueName, continentalsQueueOptions);
        logger.info(`Queue ${continentalsQueueName} is ready with options: ${JSON.stringify(continentalsQueueOptions)}`);

        channel.prefetch(1); // Process one message at a time
        logger.info(`Waiting for messages in queue: ${mainQueueName}`);

        const isWithinRange = (code, rangeStart, rangeEnd) =>
            code >= rangeStart && code <= rangeEnd;

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

                        // Determine the target queue based on product_code
                        const targetQueueName = isWithinRange(product_code, 'J31010101', 'J31019199') ||
                            isWithinRange(product_code, 'J31030101', 'J31032199')
                            ? continentalsQueueName
                            : baconQueueName;

                        // Publish the message to the target queue
                        channel.sendToQueue(targetQueueName, Buffer.from(JSON.stringify(messageData)), {
                            persistent: true,
                        });
                        logger.info(`Republished message to queue: ${targetQueueName}`);
                        channel.ack(msg);
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

await consumeAndRepublishData();
