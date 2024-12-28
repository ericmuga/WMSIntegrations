import { checkAndInsertQueueStatus } from '../Utils/dbUtils.js';
import { getRabbitMQConnection, rabbitmqConfig } from '../../config/default.js';
import logger from '../../logger.js';

/**
 * Publish messages to RabbitMQ.
 *
 * @param {string} queueName - The name of the queue to publish to.
 * @param {string} tableName - The name of the source table.
 * @param {Array} data - The array of data objects to write.
 */
export const publishToQueue = async (queueName, tableName, data) => {
  try {
    const connection = await getRabbitMQConnection();
    const channel = await connection.createChannel();

    const queueOptions = {
      durable: true,
      arguments: {
        ...rabbitmqConfig.queueArguments,
        'x-dead-letter-routing-key': queueName,
      },
    };

    await channel.assertQueue(queueName, queueOptions);

    for (const item of data) {
    try {
      const isNew = await checkAndInsertQueueStatus(tableName, item.id);

      if (!isNew) {
        logger.info(`Record with ID ${item.id} already exists in queue_status but is not new, skipping publishing.`);
      } else {
        // Publish if the status is `new`
        const message = JSON.stringify(item);
        channel.sendToQueue(queueName, Buffer.from(message), { persistent: true });
        logger.info(`Message sent to queue ${queueName} for record ID ${item.id}`);
      }
    } catch (error) {
      logger.error(`Error processing record ID ${item.id}: ${error.message}`);
    }
  }


    await channel.close();
    logger.info(`Finished publishing ${data.length} messages to queue: ${queueName}`);
  } catch (error) {
    logger.error('Error publishing messages to RabbitMQ: ' + error.message);
    throw error;
  }
};
