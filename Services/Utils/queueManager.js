// rabbit/queueManager.js
// import amqp from 'amqplib';
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

async function getQueueProperties(channel, queueName) {
  try {
    const { messageCount, consumerCount, queue, ...props } = await channel.checkQueue(queueName);
    return props;
  } catch (error) {
    if (error.code === 404) {
      return null;
    }
    throw error;
  }
}

async function recreateQueue(channel, queueName, exchange, dlx) {
  const dlQueue = `${queueName}.dl`;
  const replyQueue = `${queueName}.reply`;

  // Delete existing queues if they exist
  try {
    await channel.deleteQueue(queueName, { ifUnused: false, ifEmpty: false });
    await channel.deleteQueue(dlQueue, { ifUnused: false, ifEmpty: false });
    await channel.deleteQueue(replyQueue, { ifUnused: false, ifEmpty: false });
    logger.info(`Deleted existing queues for ${queueName}`);
  } catch (deleteError) {
    if (deleteError.code !== 404) { // Only log if it's not a "not found" error
      logger.warn(`Error deleting queues: ${deleteError.message}`);
    }
  }

  // Recreate queues with current configuration
  await channel.assertQueue(dlQueue, { durable: true });
  await channel.assertQueue(queueName, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': dlx,
      'x-dead-letter-routing-key': queueName // Added this for better DLQ routing
    },
  });
  await channel.assertQueue(replyQueue, { durable: true, autoDelete: true });

  // Rebind queues
  await channel.bindQueue(queueName, exchange, queueName);
  await channel.bindQueue(dlQueue, dlx, queueName);

  logger.info(`Recreated queues: ${queueName}, ${dlQueue}, ${replyQueue}`);
}

async function createQueue(channel, queueName, exchange, dlx, forceRecreate = false) {
  const primaryQueueName = ensureBCQueueName(queueName);
  
  if (forceRecreate) {
    await recreateQueue(channel, primaryQueueName, exchange, dlx);
    return;
  }

  const existingProps = await getQueueProperties(channel, primaryQueueName);
  const needsRecreation = existingProps && (
    existingProps.arguments?.['x-dead-letter-exchange'] !== dlx ||
    existingProps.arguments?.['x-dead-letter-routing-key'] !== primaryQueueName
  );

  if (needsRecreation) {
    logger.warn(`Queue ${primaryQueueName} exists with different DLX configuration. Recreating...`);
    await recreateQueue(channel, primaryQueueName, exchange, dlx);
  } else if (!existingProps) {
    // Queue doesn't exist, create fresh
    await recreateQueue(channel, primaryQueueName, exchange, dlx);
  } else {
    logger.info(`Queue ${primaryQueueName} already exists with correct configuration`);
  }
}

export async function setupRabbitMQQueue(queueName, forceRecreate = false) {
  try {
    const primaryQueueName = ensureBCQueueName(queueName);
    const connection = await getRabbitMQConnection();
    const channel = await connection.createChannel();

    await channel.assertExchange(rabbitmqConfig.defaultExchange, 'direct', { durable: true });
    await channel.assertExchange(rabbitmqConfig.deadLetterExchange, 'direct', { durable: true });

    await createQueue(channel, primaryQueueName, 
      rabbitmqConfig.defaultExchange, 
      rabbitmqConfig.deadLetterExchange,
      forceRecreate
    );

    logger.info(`RabbitMQ queues setup complete for ${primaryQueueName}`);
    return { connection, channel };
  } catch (error) {
    logger.error(`Error setting up RabbitMQ queues: ${error.message}`);
    throw error;
  }
}

// ... rest of your existing code (deleteRabbitMQQueue, fetchProductionOrdersFromQueue, publishGroupedOrdersToQueue) ...

// Example usage with recreation
async function recreateAllQueues() {
  try {
    await setupRabbitMQQueue('invoices_fcl', true);
    await setupRabbitMQQueue('invoices_cm', true);
    await setupRabbitMQQueue('invoices_rmk', true);
    logger.info('All queues recreated successfully');
  } catch (error) {
    logger.error('Error recreating queues:', error);
  }
}

// Uncomment to run recreation
// recreateAllQueues();