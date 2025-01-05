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
    const records = await fetchAndInsertQueueStatus(sourceTable, queueTable,queueName, queryParams);
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

export const transformFn = (row) => ({
  product_code: row.product_code,
  transfer_from_location: row.transfer_from_location,
  transfer_to_location: row.transfer_to_location,
  receiver_total_pieces: row.receiver_total_pieces,
  receiver_total_weight: row.receiver_total_weight,
  received_by: row.received_by,
  production_date: row.production_date,
  with_variance: row.with_variance,
  timestamp: row.created_at,
  id: row.id,
  company_name: 'FCL',
});




export const runQueueWorkflow = async (
  sourceTable,
  queueTable,
  queueName,
  customParams,
  queryParams = {}, // Accept queryParams from caller
  transformFn
) => {
  try {
    const defaultParams = {
      start_date: queryParams?.start_date || '2024-12-16',
      startDate: queryParams?.startDate || new Date('2024-12-16'),
    };

    const mergedParams = { ...defaultParams, ...customParams };

    await processQueueWorkflow(sourceTable, queueTable, queueName, mergedParams, transformFn);

    console.log(`Queue processing workflow for '${queueName}' completed.`);
  } catch (error) {
    console.error(`Queue processing workflow for '${queueName}' failed: ${error.message}`);
    throw error;
  }
};


