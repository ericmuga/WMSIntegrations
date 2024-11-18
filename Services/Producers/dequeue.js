import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up
import { transformData } from '../Transformers/transformer.js';

export const processAndRepublish = async (prefetchCount = 10) => {
    const sourceQueue = 'production_data_order_breaking.bc';
    const destinationExchange = 'fcl.exchange.direct';
    const destinationRoutingKey = 'processed_data_queue';
    const deadLetterExchange = 'fcl.exchange.dlx';
    const sourceQueueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': deadLetterExchange,
            'x-dead-letter-routing-key': sourceQueue
        }
    };

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        // Assert source queue and destination exchange
        await channel.assertQueue(sourceQueue, sourceQueueOptions);
        await channel.assertExchange(destinationExchange, 'direct', { durable: true });

        // Set prefetch count for batch processing
        channel.prefetch(prefetchCount);

        logger.info(`Waiting for messages in queue: ${sourceQueue}, prefetch count set to ${prefetchCount}`);

        channel.consume(sourceQueue, async (msg) => {
            if (msg !== null) {
                try {
                    // Parse message
                    const breakingData = JSON.parse(msg.content.toString());
                    logger.info(`Received message from ${sourceQueue}: ${JSON.stringify(breakingData)}`);

                    // Transform the data
                    const transformedData = transformData(breakingData);
                    logger.info(`Transformed data: ${JSON.stringify(transformedData)}`);

                    // Publish to the destination exchange with the appropriate routing key
                    channel.publish(
                        destinationExchange,
                        destinationRoutingKey,
                        Buffer.from(JSON.stringify(transformedData))
                    );
                    logger.info(`Published transformed data to ${destinationRoutingKey}`);

                    // Acknowledge the original message
                    // channel.ack(msg);
                } catch (error) {
                    logger.error(`Error processing message: ${error.message}`);
                    channel.nack(msg, false, false); // Reject the message without requeueing
                }
            } else {
                logger.warn("Received null message");
            }
        }, { noAck: false });
    } catch (error) {
        logger.error(`Error in processAndRepublish: ${error.message}`);
        throw error;
    }
};
