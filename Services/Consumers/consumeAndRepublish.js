import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js';

export const consumeAndRepublishData = async () => {
    const mainQueueName = 'production_data_transfer.bc';
    const mainExchange = 'fcl.exchange.direct';
    const dlExchange = 'fcl.exchange.dlx';
    const routingKey = 'production_data_transfer.bc';

    const queueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': dlExchange,
            'x-dead-letter-routing-key': routingKey,
        },
    };

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        await channel.assertExchange(mainExchange, 'direct', { durable: true });
        await channel.assertQueue(mainQueueName, queueOptions);
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

                        let {
                            transfer_from_location,
                            transfer_to_location,
                        } = messageData;

                        // Interpret special cases
                        if (transfer_from_location === null) {
                            transfer_from_location = 'CM';
                        }
                        if (transfer_from_location === '' && transfer_to_location === '') {
                            transfer_from_location = '2055';
                            transfer_to_location = '2055';
                        }

                        const targetQueueName = `transfer_from_${transfer_from_location}_to_${transfer_to_location}`;

                        try {
                            // Check if the queue exists
                            const existingQueue = await channel.checkQueue(targetQueueName);

                            // Validate existing queue arguments
                            if (
                                existingQueue &&
                                existingQueue.arguments &&
                                existingQueue.arguments['x-dead-letter-exchange'] !== dlExchange
                            ) {
                                logger.warn(
                                    `Queue ${targetQueueName} exists with different arguments. Consider deleting the queue manually to avoid conflicts.`
                                );
                            } else {
                                logger.info(`Queue ${targetQueueName} already exists with the correct arguments.`);
                            }
                        } catch (queueCheckError) {
                            // Queue doesn't exist; create it with desired arguments
                            await channel.assertQueue(targetQueueName, queueOptions);
                            logger.info(`Created queue ${targetQueueName} with options: ${JSON.stringify(queueOptions)}`);
                        }

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