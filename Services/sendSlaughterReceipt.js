import { getRabbitMQConnection } from './config/default.js';
import logger from './logger'; // Make sure you have a logger module or use console

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
