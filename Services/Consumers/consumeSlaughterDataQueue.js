import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js';
import { transformData } from '../Transformers/transformer.js';

export const consumeSlaughterData = async () => {
    const queueName = 'slaughter_line.bc';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'slaughter_line.bc';
    const batchSize = 20;
    const queueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'fcl.exchange.dlx',
            'x-dead-letter-routing-key': 'slaughter_line.bc'
        }
    };

    const connection = await getRabbitMQConnection();
    const channel = await connection.createChannel();
    await channel.assertExchange(exchange, 'direct', { durable: true });
    await channel.assertQueue(queueName, queueOptions);
    await channel.bindQueue(queueName, exchange, routingKey);

    logger.info(`Waiting for up to ${batchSize} messages in queue: ${queueName}`);

    const messages = [];
    let batchResolve;

    // Batch promise to return the messages array
    const batchPromise = new Promise((resolve) => {
        batchResolve = resolve;
    });

    channel.consume(queueName, (msg) => {
        if (msg !== null) {
            try {
                const slaughterData = JSON.parse(msg.content.toString());
                logger.info(`Received Slaughter data: ${JSON.stringify(slaughterData)}`);
                messages.push(slaughterData);
                channel.ack(msg);

                // Once we have 150 messages, resolve the promise
                if (messages.length >= batchSize) {
                    batchResolve(messages);
                }
            } catch (parseError) {
                logger.error(`Failed to parse message content: ${parseError.message}`);
                channel.nack(msg, false, false); // Move to dead-letter queue
            }
        } else {
            logger.warn("Received null message");
        }
    }, { noAck: false });

    // Wait for the batch to be filled
    await batchPromise;

    // Cleanup and close the channel
    await channel.close();
    // await connection.close();

    return messages;
};
