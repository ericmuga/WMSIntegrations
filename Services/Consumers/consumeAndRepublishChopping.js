import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js';


const setupQueuesAndExchanges = async (channel) => {
    // Main queue options
    const queueOptions = { 
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'fcl.exchange.dlx',
            'x-dead-letter-routing-key': 'production_data_order_chopping.bc', // Match the existing value
        },
    };

    // DLX queue options
    const dlxQueueOptions = {
        durable: true,
        // arguments: {
        //     'x-dead-letter-exchange': 'fcl.exchange.dlx',
        // },
    };

    // Declare exchanges
    await channel.assertExchange('fcl.exchange.direct', 'direct', { durable: true });
    await channel.assertExchange('fcl.exchange.dlx', 'direct', { durable: true });

    // Declare and bind main queue
    await channel.assertQueue('production_data_order_chopping.bc', queueOptions);
    await channel.bindQueue('production_data_order_chopping.bc', 'fcl.exchange.direct', 'production_data_order_chopping.bc');

    // Declare and bind DLX queue
    const dlxQueueName = 'production_data_order_chopping.dlq';
    await channel.assertQueue(dlxQueueName, dlxQueueOptions);
    await channel.bindQueue(dlxQueueName, 'fcl.exchange.dlx', 'production_data_order_chopping.bc'); // Match main queue's dead-letter-routing-key
};

// export default setupQueuesAndExchanges;

export default setupQueuesAndExchanges;


export const consumeAndRepublish = async () => {
    const queueName = 'production_data_order_chopping.bc';
    const dlxExchange = 'fcl.exchange.dlx'; // Dead-letter exchange
    const routingKey = 'production_data_order_chopping.dlx'; // DLX routing key

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        // Set up queues and exchanges
        await setupQueuesAndExchanges(channel);

        channel.prefetch(1); // Process one message at a time

        logger.info(`Waiting for messages in queue: ${queueName}`);

        channel.consume(
            queueName,
            async (msg) => {
                if (msg !== null) {
                    try {
                        const data = JSON.parse(msg.content.toString());
                        const createdAt = new Date(data.created_at);
                        const cutoffDate = new Date('2025-01-04');

                        if (createdAt < cutoffDate) {
                            // Acknowledge messages before 4th Jan
                            logger.info(`Acknowledging message with created_at: ${data.created_at}`);
                            channel.ack(msg);
                        } else if (
                            createdAt.toISOString().slice(0, 10) === '2025-01-04' ||
                            createdAt.toISOString().slice(0, 10) === '2025-01-05'
                        ) {
                            // Modify date to 6th Jan and republish to DLX
                            data.created_at = '2025-01-06T00:00:00.000Z';
                            logger.info(`Republishing message to DLX with updated date: ${data.created_at}`);
                            channel.publish(
                                dlxExchange,
                                routingKey,
                                Buffer.from(JSON.stringify(data)),
                                { persistent: true }
                            );
                            channel.ack(msg);
                        } else {
                            // Leave other messages in the queue
                            logger.info(`Leaving message with created_at: ${data.created_at} in the queue`);
                        }
                    } catch (error) {
                        logger.error(`Error processing message: ${error.message}`);
                        channel.nack(msg, false, false); // Send to DLX
                    }
                }
            },
            { noAck: false }
        );
    } catch (error) {
        logger.error('Error in consumer: ' + error.message);
        throw error;
    }
};


export const republishFromDLQ = async () => {
    const dlQueue = 'production_data_order_chopping.dlx';
    const mainQueue = 'production_data_order_chopping.bc';
    const defaultExchange = 'fcl.exchange.direct';
    const routingKey = 'production_data_order_chopping.bc';

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        // Ensure DLQ is set up
        await channel.assertQueue(dlQueue, { durable: true });

        logger.info(`Republishing messages from DLQ: ${dlQueue} to main queue: ${mainQueue}`);

        channel.consume(
            dlQueue,
            async (msg) => {
                if (msg !== null) {
                    try {
                        const data = JSON.parse(msg.content.toString());
                        logger.info(`Republishing message: ${JSON.stringify(data)}`);
                        channel.publish(
                            defaultExchange,
                            routingKey,
                            Buffer.from(JSON.stringify(data)),
                            { persistent: true }
                        );
                        channel.ack(msg); // Acknowledge after republishing
                    } catch (error) {
                        logger.error(`Error republishing message: ${error.message}`);
                        channel.nack(msg, false, false); // Keep in DLQ if there's an error
                    }
                }
            },
            { noAck: false }
        );
    } catch (error) {
        logger.error('Error republishing from DLQ: ' + error.message);
        throw error;
    }
};


 await consumeAndRepublish();

    await republishFromDLQ();