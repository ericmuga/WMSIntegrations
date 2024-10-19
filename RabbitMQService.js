import amqp from 'amqplib';
import {rabbitmqConfig} from './config/default.js';  // Import the plain JS config object
import logger from './logger.js'; // Assuming you have a logger module set up

async function connectRabbitMQ() {
    try {
        // Access the properties directly from the rabbitmqConfig object
        const connection = await amqp.connect({
            protocol: 'amqp',
            hostname: rabbitmqConfig.host,      // No need for config.get() - just access directly
            port: rabbitmqConfig.port,
            username: rabbitmqConfig.user,
            password: rabbitmqConfig.password
        });

        logger.info('RabbitMQ connection established successfully.');
        return connection;
    } catch (error) {
        logger.error('Failed to establish RabbitMQ connection: ' + error.message);
        throw error;
    }
}

export default connectRabbitMQ;
