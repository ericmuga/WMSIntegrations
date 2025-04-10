import amqp from 'amqplib';
import { rabbitmqConfig } from '../../config/default.js';
import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js';

async function queueExists(channel, queueName) {
    try {
        await channel.checkQueue(queueName);
        return true;
    } catch (error) {
        if (error.code === 404) {
            return false;
        }
        throw error;
    }
}

async function createQueue(channel, queueName, exchange, dlx) {
    const dlQueue = `${queueName}.dl`;
    const replyQueue = `${queueName}.reply`;
    
    if (await queueExists(channel, queueName)) {
        console.log(`Queue already exists: ${queueName}`);
        return;
    }

    // Declare Dead Letter Queue
    await channel.assertQueue(dlQueue, {
        durable: true
    });

    // Declare Main Queue with DLX
    await channel.assertQueue(queueName, {
        durable: true,
        arguments: {
            "x-dead-letter-exchange": dlx,
        }
    });

    // Declare Reply Queue
    await channel.assertQueue(replyQueue, {
        durable: true,
        autoDelete: true
    });

    // Bind queues to exchanges
    await channel.bindQueue(queueName, exchange, queueName);
    await channel.bindQueue(dlQueue, dlx, queueName);

    console.log(`Queues created: ${queueName}, ${dlQueue}, ${replyQueue}`);
}

export async function setupRabbitMQQueue(queueName) {
    try {
        const connection = await amqp.connect({
            protocol: 'amqp',
            hostname: rabbitmqConfig.host,
            port: rabbitmqConfig.port,
            username: rabbitmqConfig.user,
            password: rabbitmqConfig.password,
        });
        const channel = await connection.createChannel();

        // Declare exchanges
        await channel.assertExchange(rabbitmqConfig.defaultExchange, 'direct', { durable: true });
        await channel.assertExchange(rabbitmqConfig.deadLetterExchange, 'direct', { durable: true });

        // Create queues
        await createQueue(channel, queueName, rabbitmqConfig.defaultExchange, rabbitmqConfig.deadLetterExchange);

        console.log(`RabbitMQ queues setup complete for ${queueName}`);
        return { connection, channel };
    } catch (error) {
        console.error(`Error setting up RabbitMQ queues: ${error.message}`);
        throw error;
    }
}

export async function deleteRabbitMQQueue(queueName) {
    try {
        const connection = await amqp.connect({
            protocol: 'amqp',
            hostname: rabbitmqConfig.host,
            port: rabbitmqConfig.port,
            username: rabbitmqConfig.user,
            password: rabbitmqConfig.password,
        });
        const channel = await connection.createChannel();

        const dlQueue = `${queueName}.dl`;
        const replyQueue = `${queueName}.reply`;

        // Delete queues
        await channel.deleteQueue(queueName);
        await channel.deleteQueue(dlQueue);
        await channel.deleteQueue(replyQueue);

        console.log(`Queues deleted: ${queueName}, ${dlQueue}, ${replyQueue}`);
        await connection.close();
    } catch (error) {
        console.error(`Error deleting RabbitMQ queues: ${error.message}`);
        throw error;
    }
}





export const fetchProductionOrdersFromQueue = async (batchSize = 100) => {
    const queueName = 'production_orders.bc';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'production_orders.bc';

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        await channel.assertExchange(exchange, 'direct', { durable: true });
        await channel.assertQueue(queueName, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': 'fcl.exchange.dlx',
                'x-dead-letter-routing-key': routingKey,
            },
        });
        await channel.bindQueue(queueName, exchange, routingKey);

        channel.prefetch(batchSize);

        const messages = [];

        await new Promise((resolve) => {
            channel.consume(
                queueName,
                (msg) => {
                    if (msg) {
                        try {
                            const data = JSON.parse(msg.content.toString());
                            messages.push(data);
                            channel.ack(msg);

                            if (messages.length >= batchSize) {
                                resolve();
                            }
                        } catch (err) {
                            logger.error(`Error parsing message: ${err.message}`);
                            channel.nack(msg, false, false); // Move to DLQ
                        }
                    }
                },
                { noAck: false }
            );

            // Timeout to exit gracefully even if fewer messages are available
            setTimeout(() => {
                logger.info(`Timeout reached for queue: ${queueName}, fetched ${messages.length} messages.`);
                resolve();
            }, 5000); // 5 seconds
        });

        await channel.close();

        if (messages.length === 0) {
            logger.info(`No messages processed from queue: ${queueName}`);
        }

        return messages;
    } catch (error) {
        logger.error(`Error fetching production orders: ${error.message}`);
        throw error;
    }
};




