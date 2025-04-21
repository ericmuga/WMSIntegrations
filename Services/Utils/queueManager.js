// rabbit/queueManager.js
import amqp from 'amqplib';
import logger from '../../logger.js';
import { rabbitmqConfig, getRabbitMQConnection } from '../../config/rabbitConfig.js';

function ensureBCQueueName(name) {
  return name.endsWith('.bc') ? name : `${name}.bc`;
}

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
  const primaryQueueName = ensureBCQueueName(queueName);
  const dlQueue = `${primaryQueueName}.dl`;
  const replyQueue = `${primaryQueueName}.reply`;

  // if (await queueExists(channel, primaryQueueName)) {
  //   console.log(`Queue already exists: ${primaryQueueName}`);
  //   return;
  // }

  await channel.assertQueue(dlQueue, { durable: true });
  await channel.assertQueue(primaryQueueName, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': dlx,
    },
  });
  await channel.assertQueue(replyQueue, { durable: true, autoDelete: true });

  await channel.bindQueue(primaryQueueName, exchange, primaryQueueName);
  await channel.bindQueue(dlQueue, dlx, primaryQueueName);

  console.log(`Queues created: ${primaryQueueName}, ${dlQueue}, ${replyQueue}`);
}

export async function setupRabbitMQQueue(queueName) {
  try {
    const primaryQueueName = ensureBCQueueName(queueName);
    const connection = await getRabbitMQConnection();
    const channel = await connection.createChannel();

    await channel.assertExchange(rabbitmqConfig.defaultExchange, 'direct', { durable: true });
    await channel.assertExchange(rabbitmqConfig.deadLetterExchange, 'direct', { durable: true });

    await createQueue(channel, primaryQueueName, rabbitmqConfig.defaultExchange, rabbitmqConfig.deadLetterExchange);

    console.log(`RabbitMQ queues setup complete for ${primaryQueueName}`);
    return { connection, channel };
  } catch (error) {
    console.error(`Error setting up RabbitMQ queues: ${error.message}`);
    throw error;
  }
}

export async function deleteRabbitMQQueue(queueName) {
  try {
    const primaryQueueName = ensureBCQueueName(queueName);
    const connection = await getRabbitMQConnection();
    const channel = await connection.createChannel();

    const dlQueue = `${primaryQueueName}.dl`;
    const replyQueue = `${primaryQueueName}.reply`;

    await channel.deleteQueue(primaryQueueName);
    await channel.deleteQueue(dlQueue);
    await channel.deleteQueue(replyQueue);

    console.log(`Queues deleted: ${primaryQueueName}, ${dlQueue}, ${replyQueue}`);
    await connection.close();
  } catch (error) {
    console.error(`Error deleting RabbitMQ queues: ${error.message}`);
    throw error;
  }
}

export const fetchProductionOrdersFromQueue = async (batchSize = 100) => {
  const rawQueueName = 'production_orders';
  const queueName = ensureBCQueueName(rawQueueName);
  const exchange = rabbitmqConfig.defaultExchange;
  const routingKey = queueName;

  try {
    const connection = await getRabbitMQConnection();
    const channel = await connection.createChannel();

    await channel.assertExchange(exchange, 'direct', { durable: true });
    await channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': rabbitmqConfig.deadLetterExchange,
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
              if (messages.length >= batchSize) resolve();
            } catch (err) {
              logger.error(`Error parsing message: ${err.message}`);
              channel.nack(msg, false, false);
            }
          }
        },
        { noAck: false }
      );

      setTimeout(() => {
        logger.info(`Timeout reached for queue: ${queueName}, fetched ${messages.length} messages.`);
        resolve();
      }, 5000);
    });

    await channel.close();
    if (messages.length === 0) logger.info(`No messages processed from queue: ${queueName}`);
    return messages;
  } catch (error) {
    logger.error(`Error fetching production orders: ${error.message}`);
    throw error;
  }
};

export const publishGroupedOrdersToQueue = async (queueName, groupedOrders) => {
  const primaryQueueName = ensureBCQueueName(queueName);
  const connection = await getRabbitMQConnection();
  const channel = await connection.createChannel();

  await channel.assertExchange(rabbitmqConfig.defaultExchange, 'direct', { durable: true });
  await channel.assertQueue(primaryQueueName, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': rabbitmqConfig.deadLetterExchange,
    },
  });
  await channel.bindQueue(primaryQueueName, rabbitmqConfig.defaultExchange, primaryQueueName);

  for (const order of groupedOrders) {
    const payload = JSON.stringify(order);
    const sent = channel.sendToQueue(primaryQueueName, Buffer.from(payload), {
      persistent: true,
    });

    if (!sent) {
      logger.error(`Failed to publish order: ${order.ext_doc_no}`);
    } else {
      logger.info(`Published order: ${order.ext_doc_no}`);
    }
  }

  await channel.close();
};

setupRabbitMQQueue('bot_order_last_line')