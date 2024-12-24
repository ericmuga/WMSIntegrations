import { fetchAndInsertQueueStatus ,updateQueueStatus } from '../Utils/dbUtils.js';

import { publishToQueue } from '../Producers/publishToQueue.js';

/**
 * Workflow to fetch, publish, and update records for RabbitMQ.
 *
 * @param {string} sourceTable - The name of the source table.
 * @param {string} queueTable - The name of the queue status table.
 * @param {string} queueName - The RabbitMQ queue name.
 * @param {Object} queryParams - Query parameters for fetching records.
 * @param {function} transformFn - Transformation function for the records.
 */
export const processQueueWorkflow = async (sourceTable, queueTable, queueName, queryParams, transformFn) => {
  try {
    const records = await fetchAndInsertQueueStatus(sourceTable, queueTable, queryParams);
    console.log('Records fetched:', records);

    if (!Array.isArray(records) || records.length === 0) {
      console.log('No new records to process.');
      return;
    }

    const data = transformFn ? records.map(transformFn) : records;
    console.log('Data to publish:', data);

    await publishToQueue(queueName, sourceTable, data);

    const recordIds = records
      .filter((record) => record.record_id !== undefined) // Ensure valid `record_id`
      .map((record) => record.record_id);

    console.log('Record IDs for status update:', recordIds);

    if (recordIds.length === 0) {
      console.error('No valid record IDs found for status update. Skipping update.');
      return;
    }

    await updateQueueStatus(recordIds, 'published', sourceTable)
      .then(() => {
        console.log('Queue status updated successfully.');
      })
      .catch((error) => {
        console.error(`Failed to update queue status: ${error.message}`);
      });
  } catch (error) {
    console.error(`Error in queue processing workflow: ${error.message}`);
    throw error;
  }
};

