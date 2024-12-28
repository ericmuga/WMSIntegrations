import { poolPromise } from '../../config/default.js'; // Database connection pool
import pkg from 'mssql';
import logger from '../../logger.js';
// const { sql } = pkg;
/**
 * Execute a SQL query with dynamic parameters and return the result set.
 *
 * @param {string} baseQuery - The base SQL query with placeholders for parameters.
 * @param {Object} queryParams - The custom query parameters.
 * @param {Object} [defaultParams={}] - The default parameters for every query.
 * @returns {Promise<Array>} - The recordset from the query.
 */
export const executeQueryWithParams = async (baseQuery, queryParams, defaultParams = {}) => {
  try {
    const additionalConditions = buildAdditionalConditions(queryParams);

    // Replace {{additionalConditions}} in the base query
    const queryWithConditions = baseQuery.replace('{{additionalConditions}}', additionalConditions);

    // Merge default and custom parameters
    const params = { ...defaultParams, ...queryParams };

    // Replace parameters in the query
    const sqlQuery = Object.keys(params).reduce((query, key) => {
      const value = params[key];
      const safeValue = typeof value === 'string' ? `'${value}'` : value;
      return query.replace(new RegExp(`:${key}`, 'g'), safeValue);
    }, queryWithConditions);

    const pool = await poolPromise;
    const result = await pool.request().query(sqlQuery);

    return result.recordset;
  } catch (error) {
    console.error(`Error executing query with params: ${error.message}`);
    throw error;
  }
};

/**
 * Execute a SQL query and return the result set.
 *
 * @param {string} query - The SQL query to execute.
 * @returns {Promise<Array>} - The recordset from the query.
 */
export const executeQuery = async (query) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error(`Error executing query: ${error.message}`);
    throw error;
  }
};


/**
 * Build additional WHERE clauses dynamically based on query parameters.
 *
 * @param {Object} queryParams - The query parameters object.
 * @returns {string} - A string of additional WHERE clauses.
 */
export const buildAdditionalConditions = (queryParams) => {
  const conditions = [];

  Object.keys(queryParams).forEach((key) => {
    const value = queryParams[key];

    if (Array.isArray(value)) {
      // If the value is an array, create an IN clause
      const inClause = value.map((v) => (typeof v === 'string' ? `'${v}'` : v)).join(', ');
      conditions.push(`AND ${key} IN (${inClause})`);
    } else {
      // For single values, create an equality clause
      const safeValue = typeof value === 'string' ? `'${value}'` : value;
      conditions.push(`AND ${key} = ${safeValue}`);
    }
  });

  return conditions.join(' ');
};



export const defaultParams = {
  start_date: '2024-12-16',
  
};

export const queries = {
  transfers: `
    SELECT 
        id, 
        product_code, 
        transfer_from AS transfer_from_location, 
        location_code AS transfer_to_location, 
        receiver_total_pieces, 
        receiver_total_weight, 
        received_by, 
        production_date, 
        with_variance, 
        created_at
    FROM  [FCL-WMS].[calibra].[dbo].[idt_transfers]
    WHERE receiver_total_weight > 0 
      AND created_at > :start_date
      {{additionalConditions}}
    
   
  `,
};




/**
 * Check if a record exists in the queue_status table and insert it if not.
 *
 * @param {string} tableName - The name of the source table.
 * @param {number} recordId - The ID of the record.
 * @returns {Promise<boolean>} - Returns true if the record is new and was inserted.
 */
export const checkAndInsertQueueStatus = async (tableName, recordId) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('table_name', tableName)
      .input('record_id', recordId)
      .query(`
        IF NOT EXISTS (
          SELECT 1 
          FROM queue_status 
          WHERE table_name = @table_name AND record_id = @record_id
        )
        BEGIN
          INSERT INTO queue_status (table_name, record_id, status)
          VALUES (@table_name, @record_id, 'new');
          SELECT 1 AS isNew;
        END
        ELSE
        BEGIN
          SELECT 
            CASE 
              WHEN status = 'new' THEN 1
              ELSE 0
            END AS isNew
          FROM queue_status 
          WHERE table_name = @table_name AND record_id = @record_id;
        END
      `);

    if (result.recordset && result.recordset.length > 0) {
      const isNew = result.recordset[0].isNew === 1;
      console.log(`Result for Record ID ${recordId}:`, isNew ? 'New and eligible for publishing' : 'Already exists but not new');
      return isNew;
    }

    throw new Error('Unexpected result structure from query.');
  } catch (error) {
    console.error(`Error checking and inserting queue status: ${error.message}`);
    throw error;
  }
};




export const updateQueueStatus = async (recordIds, status, tableName) => {
  try {
    console.log('Updating queue status with:', { recordIds, status, tableName });

    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      throw new Error('No record IDs provided for status update.');
    }

    const pool = await poolPromise;

    // Format the record IDs for the SQL IN clause
    const idList = recordIds.map((id) => (typeof id === 'string' ? `'${id}'` : id)).join(',');

    console.log('Formatted ID list for batch update:', idList);

    const result = await pool.request()
      .query(`
        UPDATE queue_status
        SET status = '${status}'
        WHERE record_id IN (${idList})
          AND table_name = '${tableName}';
      `);

    console.log(`Update result: ${result.rowsAffected[0]} rows updated.`);
    if (result.rowsAffected[0] === 0) {
      console.warn('No rows were updated. Ensure record IDs and table name match.');
    }
  } catch (error) {
    console.error(`Error updating queue status: ${error.message}`);
    throw error;
  }
};




/**
 * Fetch records from the source table where they are not in queue_status and insert into queue_status.
 *
 * @param {string} sourceTable - The name of the source table.
 * @param {string} queueTable - The name of the queue status table.
 * @param {Object} queryParams - Query parameters to filter the source table.
 * @returns {Promise<Array>} - The fetched records.
 */
export const fetchAndInsertQueueStatus = async (sourceTable, queueTable, queryParams = {}) => {
  try {
    const pool = await poolPromise;
    const { startDate, productCodeRanges = [] } = queryParams;
    const today = new Date(); // Current date

    // Build dynamic filtering for product codes
    const productCodeConditions = productCodeRanges
      .map(
        ({ rangeStart, rangeEnd }) =>
          `(t.product_code BETWEEN '${rangeStart}' AND '${rangeEnd}')`
      )
      .join(' OR ');

    // Add product code conditions to WHERE clause if any
    const additionalConditions = productCodeConditions
      ? `AND (${productCodeConditions})`
      : '';

    const result = await pool.request()
      .input('startDate', pkg.DateTime, startDate ? new Date(startDate) : today)
      .query(`
        -- Fetch records not in queue_status
        WITH NewRecords AS (
          SELECT t.id AS record_id, t.* -- Ensure record_id is explicitly selected
          FROM ${sourceTable} t
          WHERE NOT EXISTS (
            SELECT 1 FROM ${queueTable} qs
            WHERE qs.table_name = '${sourceTable}' AND qs.record_id = t.id
          )
          AND t.created_at >= @startDate
          ${additionalConditions}
        )
        -- Insert into queue_status and return fetched records
        INSERT INTO ${queueTable} (table_name, record_id, status)
        SELECT '${sourceTable}', id, 'new'
        FROM NewRecords;

        -- Return the inserted records
        SELECT t.id AS record_id, t.*
        FROM ${sourceTable} t
        WHERE EXISTS (
          SELECT 1
          FROM ${queueTable} qs
          WHERE qs.table_name = '${sourceTable}' AND qs.record_id = t.id
          AND qs.status = 'new'
        )
        AND t.created_at >= @startDate
        ${additionalConditions};
      `);

    return result.recordset || []; // Return the fetched records
  } catch (error) {
    console.error(`Error fetching and inserting queue status: ${error.message}`);
    throw error;
  }
};




