import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up
import { transformData } from '../Transformers/breakingTransformer.js';
import { minceLookup } from '../Transformers/Mincing.js';

export const consumeButcheryToSausageTransfers = async () => {
    const queueName = 'transfer_from_1570_to_2055';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'transfer_from_1570_to_2055';
    const batchSize = 2; // Set batch size here
    const timeout = 5000; // Timeout in milliseconds (e.g., 5 seconds)
    
    const queueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'fcl.exchange.dlx',
            'x-dead-letter-routing-key': 'transfer_from_1570_to_2055',
        },
    };

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        // await channel.assertExchange(exchange, 'direct', { durable: true });
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
                        const transferData = JSON.parse(msg.content.toString());
                        logger.info(`Received transfer data: ${JSON.stringify(transferData)}`);

                        //if items in the transfer push and ack else do nothing

                        const lookupEntry = minceLookup.find(
                            (entry) =>
                                entry.from === transferData.from &&
                                entry.to === transferData.to &&
                                transferData.intake_items.every((item) =>
                                    entry.intake_items.includes(item)
                                )
                          );
                
                        if (lookupEntry) {
                            // Transform and add valid message data
                            messages.push(transformData(transferData));
                            //channel.ack(msg);
                
                            // If batch size is reached, resolve the promise
                            if (messages.length >= batchSize) {
                                clearTimeout(batchTimeout); // Clear timeout if batch is filled
                                batchResolve(messages);
                            }
                        } else {
                            logger.warn(
                                `Message did not match lookup: ${JSON.stringify(transferData)}`
                            );
                            // Reject message without requeuing (sends to DLX)
                            //channel.nack(msg, false, false);

                        // If batch size is reached, resolve the promise
                        if (messages.length >= batchSize) {
                            clearTimeout(batchTimeout); // Clear timeout if batch is filled
                            batchResolve(messages);
                        }
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
        logger.error('Error consuming transfer data from RabbitMQ: ' + error.message);
        throw error;
    }
};


const data =await consumeButcheryToSausageTransfers();
console.log(JSON.stringify(data));






