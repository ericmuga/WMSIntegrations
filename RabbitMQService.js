import amqp from 'amqplib';
import axios from 'axios';
import { rabbitmqConfig, getODataUrl, config,getRabbitMQConnection } from './config/default.js';  // Import necessary configs and helper functions
import logger from './logger.js'; // Assuming you have a logger module set up

let rabbitConnection;  // To store a single connection for RabbitMQ

// Utility function to encode credentials for Basic Auth
export const getAuthHeader = () => {
    const { username, password } = config;
    return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
};

// Function to send data to Business Central OData API
export const sendProductionOrderToBusinessCentral = async (prodOrderData) => {
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

// Function to establish and reuse RabbitMQ connection

// Function to consume messages from the RabbitMQ queue for production orders
export const consumeProductionOrder = async () => {
    const queueName='production_order.bc'
    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();
        await channel.assertQueue(queueName, { durable: true });

        logger.info(`Waiting for messages in queue: ${queueName}. To exit press CTRL+C`);

        // Consume messages from RabbitMQ
        channel.consume(queueName, async (msg) => {
            if (msg !== null) {
                const prodOrderData = msg.content.toString();
                logger.info(`Received message: ${prodOrderData}`);
                
                // Send the data to Business Central
                await sendProductionOrderToBusinessCentral(prodOrderData);
                
                // Acknowledge the message
                channel.ack(msg);
            }
        });
    } catch (error) {
        logger.error('Error consuming production order from RabbitMQ: ' + error.message);
        throw error;
    }
};

// Mock function to push a dummy production order to the RabbitMQ queue
export const pushDummyProductionOrder = async () => {
    const queueName='production_order.bc'
    const dummyOrder = {
        ItemNo: "J31031702",
        Quantity: 10,
        SourceType: "Item",
        ProductionJournalLines: [
            {
                ItemNo: "G2044",
                Quantity: 5,
                LocationCode: "3535",
                BIN: ""
            },
            {
                ItemNo: "G2001",
                Quantity: 3,
                LocationCode: "3535",
                BIN: ""
            }
        ],
        routing: {  // Adding the routing key
            key: "production_order.bc"
        }
    };

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();
        await channel.assertQueue(queueName, { durable: true });

        // Push the dummy production order to the queue
        channel.sendToQueue(queueName, Buffer.from(JSON.stringify(dummyOrder)));
        logger.info(`Dummy production order pushed to queue: ${JSON.stringify(dummyOrder)}`);

    } catch (error) {
        logger.error('Error pushing dummy production order to RabbitMQ: ' + error.message);
        throw error;
    }
};
