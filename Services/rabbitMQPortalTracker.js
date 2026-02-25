// rabbitmqTracker.js
// import amqp from 'amqplib';
import { getRabbitMQConnection } from '../config/rabbitConfig.js';

const QUEUE_NAME = 'bot_order_last_line';

export const getLastFetchedLine = async (dateKey) => {
  const conn = await getRabbitMQConnection();
  const channel = await conn.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  const message = await channel.get(QUEUE_NAME);
  if (!message) return null;

  const content = JSON.parse(message.content.toString());
  return content[dateKey] || null;
};

export const setLastFetchedLine = async (dateKey, lineNo) => {
  const conn = await getRabbitMQConnection();
  const channel = await conn.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  const current = {};
  current[dateKey] = lineNo;

  channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(current)), {
    persistent: true,
  });

  await channel.close();
};
