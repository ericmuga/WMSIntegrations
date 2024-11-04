import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up
import { transformData } from '../Transformers/transformer.js';

export const consumeBeheadingData = async () => {
    const queueName = 'production_data_order_beheading.bc';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'production_data_order_beheading.bc';
    const queueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'fcl.exchange.dlx',
            'x-dead-letter-routing-key': 'production_data_order_beheading.bc'
        }
    };

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        await channel.assertExchange(exchange, 'direct', { durable: true });
        await channel.assertQueue(queueName, queueOptions);
        await channel.bindQueue(queueName, exchange, routingKey);

        logger.info(`Waiting for a single message in queue: ${queueName}`);

        // Consume only one message
        const message = await new Promise((resolve, reject) => {
            channel.consume(queueName, (msg) => {
                if (msg !== null) {
                    try {
                        const beheadingData = JSON.parse(msg.content.toString());
                        logger.info(`Received beheading data: ${JSON.stringify(beheadingData)}`);
                        //channel.ack(msg);
                        resolve(transformData(beheadingData));
                    } catch (parseError) {
                        logger.error(`Failed to parse message content: ${parseError.message}`);
                        channel.nack(msg);
                        reject(parseError);
                    }
                } else {
                    logger.warn("Received null message");
                    resolve(null);
                }
            }, { noAck: false });
        });

        await channel.close();
        // await connection.close();
        return message;
    } catch (error) {
        logger.error('Error consuming beheading data from RabbitMQ: ' + error.message);
        throw error;
    }
};