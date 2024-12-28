import { executeQueryWithParams } from '../Utils/dbUtils.js';
import { publishToQueue } from '../Producers/publishToQueue.js';

/**
 * Main function to query the database and write to RabbitMQ.
 *
 * @param {string} baseQuery - The base SQL query with placeholders for parameters.
 * @param {Object} queryParams - The custom query parameters.
 * @param {string} queueName - The name of the RabbitMQ queue to write to.
 * @param {function} transformFn - Optional transformation function for the data.
 * @param {Object} [defaultParams={}] - Default query parameters.
 */
export const queryAndPublishWithParams = async (
  baseQuery,
  queryParams,
  queueName,
  transformFn = null,
  defaultParams = {}
) => {
  try {
    const recordset = await executeQueryWithParams(baseQuery, queryParams, defaultParams);
    console.log(`Fetched ${recordset.length} records from the database`);

    const data = transformFn
      ? recordset.map(transformFn)
      : recordset;

    if (data.length > 0) {
      await publishToQueue(queueName, data);
    } else {
      console.log('No records to send to the queue');
    }
  } catch (error) {
    console.error('Error in query and publish process: ' + error.message);
    throw error;
  }
};
