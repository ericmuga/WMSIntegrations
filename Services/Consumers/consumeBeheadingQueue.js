import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up
import { transformData } from '../Transformers/transformer.js';

export const consumeBeheadingData = async () => {
    const queueName = 'production_data_order_beheading.bc';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'production_data_order_beheading.bc';
    const batchSize = 10;
    const timeout = 2000; // Timeout in milliseconds (e.g., 5 seconds)

    const queueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'fcl.exchange.dlx',
            'x-dead-letter-routing-key': 'production_data_order_beheading.bc',
        },
    };

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        await channel.assertExchange(exchange, 'direct', { durable: true });
        await channel.assertQueue(queueName, queueOptions);
        await channel.bindQueue(queueName, exchange, routingKey);

        // Prefetch to limit the number of unacknowledged messages delivered
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

        // Start consuming messages
        channel.consume(
            queueName,
            (msg) => {
                if (msg !== null) {
                    try {
                        const beheadingData = JSON.parse(msg.content.toString());
                        logger.info(`Received beheading data: ${JSON.stringify(beheadingData)}`);
                        messages.push(transformData(beheadingData)); // Transform each message data
                        channel.ack(msg);

                        // Resolve the promise if the batch size is reached
                        if (messages.length >= batchSize) {
                            clearTimeout(batchTimeout); // Clear the timeout if the batch is filled
                            const finalData = messages.flat(); // Flatten the messages
                            batchResolve(finalData);
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
        const result = await batchPromise;

        // Cleanup and close the channel
        await channel.close();

        return result;
    } catch (error) {
        logger.error(`Error consuming beheading data from RabbitMQ: ${error.message}`);
        throw error;
    }
};

