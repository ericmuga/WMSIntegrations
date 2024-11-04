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


export const sendSlaughterReceipt = async (routing, receiptLines) => {
    try {
      // Use the existing RabbitMQ connection
      const connection = await getRabbitMQConnection();
      const channel = await connection.createChannel();
      const exchange = 'fcl.exchange.direct';
      const routingKey = routing.key;
      const payload = JSON.stringify({ routing, receiptLines });
  
      // Ensure the exchange is asserted in case it doesn't exist
      await channel.assertExchange(exchange, 'direct', { durable: true });
      channel.publish(exchange, routingKey, Buffer.from(payload), { persistent: true });
  
      logger.info('Sent slaughter receipt to RabbitMQ:', { routing, receiptLines });
  
      await channel.close(); // Close only the channel, keep connection open for reuse
    } catch (error) {
      logger.error('Failed to send slaughter receipt to RabbitMQ:', error);
      throw error; // Rethrow the error to handle it in the route
    }
  };

  export const sendProductionOrderError = async (errorMessage, orderNo) => {
    try {
      const connection = await getRabbitMQConnection();
      const channel = await connection.createChannel();
      const exchange = 'fcl.exchange.direct';
      const routingKey = 'production.order.error';
      const payload = JSON.stringify({
        errorMessage,
        routingKey,
        orderNo,
        timestamp: new Date().toISOString()
      });
  
      await channel.assertExchange(exchange, 'direct', { durable: true });
      channel.publish(exchange, routingKey, Buffer.from(payload), { persistent: true });
  
      logger.info('Sent production order error to RabbitMQ:', { errorMessage, orderNo });
  
      await channel.close();
    } catch (error) {
      logger.error('Failed to send production order error to RabbitMQ:', error);
      throw error;
    }
  };


  // Add this function to your rabbitMQService.js

// Function to consume messages from RabbitMQ for butchery data processing
let latestButcheryData = null; // Global variable to store the latest message data

const convertToProductionOrder = (data) => {
    const currentDateTime = new Date().toISOString();

    const productionOrder = {
        production_order_no: "PO001",
        ItemNo: "G1030",
        Quantity: 10,
        uom: "PC",
        LocationCode: "1020",
        BIN: "",
        user: "EMUGA",
        line_no: 1000,
        routing: "production_order.bc",
        date_time: currentDateTime,
        ProductionJournalLines: []
    };

    data.forEach((item, index) => {
        productionOrder.ProductionJournalLines.push({
            ItemNo: item.item_code,
            Quantity: parseFloat(item.net_weight),
            uom: "KG",
            LocationCode: "1020",
            BIN: "",
            line_no: productionOrder.line_no + (index * 1000),
            type: "output",
            date_time: currentDateTime,
            user: item.user_id || "EMUGA"
        });

        productionOrder.ProductionJournalLines.push({
            ItemNo: "G0110",
            Quantity: parseFloat(item.net_weight),
            uom: "KG",
            LocationCode: "1020",
            BIN: "",
            line_no: productionOrder.line_no + (index * 1000) + 1000,
            type: "consumption",
            date_time: currentDateTime,
            user: item.user_id || "EMUGA"
        });
    });

    return [productionOrder];
};



// Expose latestButcheryData for external access
//export const getLatestButcheryData = () => latestButcheryData;
  

