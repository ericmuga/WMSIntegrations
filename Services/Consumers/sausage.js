import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js';
import dayjs from 'dayjs';

const createQueuesAndConsume = async (sourceQueueNames, targetQueueName, options) => {
    const {
        exchange,
        dlExchange,
        routingKey,
        dateThreshold,
        targetQueueOptions,
        dlQueueOptions,
        replyQueueOptions,
    } = options;

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        // Assert exchange for the target queue
        await channel.assertExchange(exchange, 'direct', { durable: true });

        // Assert the target queue with the given options
        await channel.assertQueue(targetQueueName, targetQueueOptions);
        await channel.bindQueue(targetQueueName, exchange, routingKey);

        // Assert the dead-letter queue
        const dlQueueName = `${targetQueueName}.dl`;
        await channel.assertQueue(dlQueueName, dlQueueOptions);

        // Assert the reply queue
        const replyQueueName = `${targetQueueName}.reply`;
        await channel.assertQueue(replyQueueName, replyQueueOptions);

        for (const sourceQueueName of sourceQueueNames) {
            logger.info(`Listening to messages from queue: ${sourceQueueName}`);

            channel.prefetch(1); // Process one message at a time
            await channel.consume(
                sourceQueueName,
                async (msg) => {
                    if (msg !== null) {
                        try {
                            const messageData = JSON.parse(msg.content.toString());
                            logger.info(`Received message from ${sourceQueueName}: ${JSON.stringify(messageData)}`);

                            const { id, timestamp } = messageData;

                            // Validate id and timestamp
                            const isInvalid =
                                !id || // No ID
                                !timestamp || // No timestamp
                                dayjs(timestamp).isBefore(dateThreshold); // Timestamp earlier than threshold

                            if (isInvalid) {
                                logger.warn(`Invalid message: ${JSON.stringify(messageData)}`);
                                channel.nack(msg, false, false); // Dead-letter the message
                                return;
                            }

                            // Publish the message to the target queue
                            channel.publish(
                                exchange,
                                routingKey,
                                Buffer.from(JSON.stringify(messageData)),
                                { persistent: true }
                            );

                            logger.info(`Message republished to queue: ${targetQueueName}`);

                            // Acknowledge the message
                            channel.ack(msg);
                        } catch (error) {
                            logger.error(`Error processing message: ${error.message}`);
                            
                            // Dead-letter the message
                            channel.nack(msg, false, false);
                        }
                    } else {
                        logger.warn('Received null message');
                    }
                },
                { noAck: false }
            );
        }
    } catch (error) {
        logger.error(`Error consuming and republishing messages: ${error.message}`);
        throw error;
    }
};

const sourceQueueNames = ['transfer_from_2055_to_3600'];
const targetQueueName = 'sausages.bc';
const options = {
    exchange: 'fcl.exchange.direct',
    dlExchange: 'fcl.exchange.dlx',
    routingKey: 'sausages.bc',
    dateThreshold: dayjs('2024-12-01'),
    targetQueueOptions: {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'fcl.exchange.dlx',
            'x-dead-letter-routing-key': 'sausages.bc',
        },
    },
    dlQueueOptions: {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'fcl.exchange.dlx',
            'x-dead-letter-routing-key': 'sausages.bc',
        },
    },
    replyQueueOptions: {
        durable: true,
        arguments: {
            'x-queue-type': 'classic',
        },
    },
};

await createQueuesAndConsume(sourceQueueNames, targetQueueName, options);
