import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up


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

        logger.info(`Waiting for messages in queue: ${queueName}. To exit press CTRL+C`);
        //   console.log(`Waiting for messages in queue: ${queueName}. To exit press CTRL+C`);
        
        try {
            await channel.consume(queueName, (msg) => {
                if (msg !== null) {
                    try {
                        const beheadingData = JSON.parse(msg.content.toString());
                        logger.info(`Received beheading data: ${JSON.stringify(beheadingData)}`);
                        channel.close();
                        return beheadingData;
                        // channel.ack(msg);
                    } catch (parseError) {
                        logger.error(`Failed to parse message content: ${parseError.message}`);
                        // Optionally reject the message if parsing fails
                        // channel.nack(msg);
                    }
                } else {
                    logger.warn("Received null message");
                }
            });
        } catch (consumeError) {
            logger.error(`Failed to consume message from queue: ${consumeError.message}`);
        }
    }        
     catch (error) {
        logger.error('Error consuming beheading data from RabbitMQ: ' + error.message);
        throw error;
    }
};
