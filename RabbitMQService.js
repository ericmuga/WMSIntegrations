import amqp from 'amqplib';
import axios from 'axios';
import { rabbitmqConfig, getODataUrl, config } from './config/default.js';  // Import necessary configs and helper functions
import logger from './logger.js'; // Assuming you have a logger module set up

// Utility function to encode credentials for Basic Auth
const getAuthHeader = () => {
    const { username, password } = config;
    return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
};

// Function to send data to Business Central OData API
const sendToBusinessCentral = async (prodOrderData) => {
    const url = getODataUrl();  // Get the OData URL from config
    try {
        const response = await axios.post(url, prodOrderData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getAuthHeader()  // Set Basic Authentication header
            }
        });
        logger.info('Data sent to Business Central successfully:', response.data);
    } catch (error) {
        logger.error('Error sending data to Business Central:', error.message);
    }
};

// Function to connect to RabbitMQ and consume messages
async function connectRabbitMQ() {
    try {
        // Access the properties directly from the rabbitmqConfig object
        const connection = await amqp.connect({
            protocol: 'amqp',
            hostname: rabbitmqConfig.host,
            port: rabbitmqConfig.port,
            username: rabbitmqConfig.user,
            password: rabbitmqConfig.password
        });

        logger.info('RabbitMQ connection established successfully.');
        
        const channel = await connection.createChannel();
        await channel.assertQueue(rabbitmqConfig.queueName, { durable: false });

        logger.info(`Waiting for messages in queue: ${rabbitmqConfig.queueName}. To exit press CTRL+C`);

        // Consume messages from RabbitMQ
        channel.consume(rabbitmqConfig.queueName, async (msg) => {
            if (msg !== null) {
                const prodOrderData = msg.content.toString();
                logger.info(`Received message: ${prodOrderData}`);
                
                // Send the data to Business Central
                await sendToBusinessCentral(prodOrderData);
                
                // Acknowledge the message
                channel.ack(msg);
            }
        });

        return connection;
    } catch (error) {
        logger.error('Failed to establish RabbitMQ connection: ' + error.message);
        throw error;
    }
}

export default connectRabbitMQ;
