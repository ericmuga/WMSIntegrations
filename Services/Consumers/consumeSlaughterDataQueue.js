import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js';
import { transformData } from '../Transformers/transformer.js';

export const consumeSlaughterData = async () => {
    const queueName = 'slaughter_line.bc';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'slaughter_line.bc';
    const batchSize = 10;
    const timeout = 2000; // Timeout in milliseconds (e.g., 5 seconds)
    const queueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'fcl.exchange.dlx',
            'x-dead-letter-routing-key': 'slaughter_line.bc',
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
        let batchResolve;
        let batchTimeout;

        // Batch promise to return the messages array
        const batchPromise = new Promise((resolve) => {
            batchResolve = resolve;
        });

        // Set a timeout to resolve with an empty array if no messages are received
        batchTimeout = setTimeout(() => {
            if (messages.length === 0) {
                logger.info('No messages received within the timeout period');
                batchResolve([]);
            }
        }, timeout);

        channel.consume(
            queueName,
            (msg) => {
                if (msg !== null) {
                    try {
                        const slaughterData = JSON.parse(msg.content.toString());
                        logger.info(`Received slaughter data: ${JSON.stringify(slaughterData)}`);
                        messages.push(transformData(slaughterData)); // Transform the data
                        channel.ack(msg);

                        // Resolve the promise if the batch size is reached
                        if (messages.length >= batchSize) {
                            clearTimeout(batchTimeout); // Clear timeout if batch is filled
                            batchResolve(messages);
                        }
                    } catch (parseError) {
                        logger.error(`Failed to parse message content: ${parseError.message}`);
                        channel.nack(msg, false, false); // Move to dead-letter queue
                    }
                } else {
                    logger.warn('Received null message');
                }
            },
            { noAck: false }
        );

        // Wait for the batch to be filled or timeout
        const batch = await batchPromise;

        // Cleanup and close the channel
        await channel.close();

        return batch;
    } catch (error) {
        logger.error(`Error consuming slaughter data from RabbitMQ: ${error.message}`);
        throw error;
    }
};
