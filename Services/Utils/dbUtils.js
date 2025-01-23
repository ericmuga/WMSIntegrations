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




// export const fetchAndInsertQueueStatus = async (sourceTable, queueTable, queueName, queryParams = {}) => {
//   try {
//     const pool = await poolPromise;
//     const { startDate, productCodeRanges = [] } = queryParams;

//     const today = new Date(); // Current date

//     // Build dynamic filtering for product codes
//     const productCodeConditions = productCodeRanges
//       .map(
//         ({ rangeStart, rangeEnd }) =>
//           `(t.product_code BETWEEN '${rangeStart}' AND '${rangeEnd}')`
//       )
//       .join(' OR ');

//     // Add product code conditions to WHERE clause if any
//     const additionalConditions = productCodeConditions
//       ? `AND (${productCodeConditions})`
//       : '';

//     const result = await pool.request()
//       .input('startDate', pkg.DateTime, startDate ? new Date(startDate) : today)
//       .query(`
//         -- Fetch records not in queue_status
//         WITH NewRecords AS (
//           SELECT t.id AS record_id, t.* -- Ensure record_id is explicitly selected
//           FROM ${sourceTable} t
//           WHERE NOT EXISTS (
//             SELECT 1 FROM ${queueTable} qs
//             WHERE qs.table_name = '${sourceTable}' AND qs.record_id = t.id
//           )
//           AND t.created_at >= @startDate
//           ${additionalConditions}
//         )
//         -- Insert into queue_status and return fetched records
//         INSERT INTO ${queueTable} (table_name, record_id, status, queue_name)
//         SELECT '${sourceTable}', id, 'new', '${queueName}'
//         FROM NewRecords;

//         -- Return the inserted records
//         SELECT t.id AS record_id, t.*
//         FROM ${sourceTable} t
//         WHERE EXISTS (
//           SELECT 1
//           FROM ${queueTable} qs
//           WHERE qs.table_name = '${sourceTable}' AND qs.record_id = t.id
//           AND qs.status = 'new' AND qs.queue_name = '${queueName}'
//         )
//         AND t.created_at >= @startDate
//         ${additionalConditions};
//       `);

//     return result.recordset || []; // Return the fetched records
//   } catch (error) {
//     console.error(`Error fetching and inserting queue status: ${error.message}`);
//     throw error;
//   }
// };


export const fetchAndInsertQueueStatus = async (sourceTable, queueTable, queueName, queryParams = {}) => {
  try {
    const pool = await poolPromise;
    const { startDate, productCodeRanges = [], location_code = [], transfer_from } = queryParams;

    if (!location_code.length || !transfer_from) {
      throw new Error('Both locationCodes and transferFrom are mandatory parameters.');
    }

    const today = new Date(); // Current date

    // Build dynamic filtering for product codes
    const productCodeConditions = productCodeRanges
      .map(
        ({ rangeStart, rangeEnd }) =>
          `(t.product_code BETWEEN '${rangeStart}' AND '${rangeEnd}')`
      )
      .join(' OR ');

    // Prepare location codes for SQL IN clause
    const locationCodeCondition = location_code.map((code) => `'${code}'`).join(',');

    // Add product code conditions to WHERE clause if any
    const additionalConditions = productCodeConditions
      ? `AND (${productCodeConditions})`
      : '';

    const result = await pool.request()
      .input('startDate', pkg.DateTime, startDate ? new Date(startDate) : today)
      .input('transferFrom', pkg.VarChar, transfer_from)
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
          AND t.location_code IN (${locationCodeCondition})
          AND t.transfer_from = @transferFrom
          AND t.receiver_total_weight > 0
          ${additionalConditions}
        )
        -- Insert into queue_status and return fetched records
        INSERT INTO ${queueTable} (table_name, record_id, status, queue_name)
        SELECT '${sourceTable}', id, 'new', '${queueName}'
        FROM NewRecords;

        -- Return the inserted records
        SELECT t.id AS record_id, t.*
        FROM ${sourceTable} t
        WHERE EXISTS (
          SELECT 1
          FROM ${queueTable} qs
          WHERE qs.table_name = '${sourceTable}' AND qs.record_id = t.id
          AND qs.status = 'new' AND qs.queue_name = '${queueName}'
        )
        AND t.created_at >= @startDate
        AND t.location_code IN (${locationCodeCondition})
        AND t.transfer_from = @transferFrom
        ${additionalConditions};
      `);

    return result.recordset || []; // Return the fetched records
  } catch (error) {
    console.error(`Error fetching and inserting queue status: ${error.message}`);
    throw error;
  }
};


// import { poolPromise } from './db'; // Import your connection pool

export const getRawProductionOrders = async ({ date, item, production_order_no }) => {
  try {
    const pool = await poolPromise;

    let query = `
      SELECT
        po.production_order_no, po.ItemNo, po.Quantity, po.uom, po.LocationCode, po.routing, po.date_time, po.status,
        pjl.ItemNo AS JournalItemNo, pjl.Quantity AS JournalQuantity, pjl.uom AS JournalUom, pjl.[type], pjl.date_time AS JournalDateTime, pjl.status AS JournalStatus
      FROM
        ProductionOrders po
      LEFT JOIN
        ProductionJournalLines pjl ON po.production_order_no = pjl.production_order_no
      WHERE
        po.status = 'raw'
    `;
    const conditions = [];
    const values = [];

    if (date) {
      conditions.push('po.date_time LIKE @date');
      values.push({ name: 'date', type: pool.NVarChar, value: `${date}%` });
    }

    if (item) {
      conditions.push('po.ItemNo = @item');
      values.push({ name: 'item', type: pool.NVarChar, value: item });
    }

    if (production_order_no) {
      conditions.push('po.production_order_no = @production_order_no');
      values.push({ name: 'production_order_no', type: pool.NVarChar, value: production_order_no });
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    const request = pool.request();
    values.forEach((param) => request.input(param.name, param.type, param.value));

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error(`Error fetching raw production orders: ${error.message}`);
    throw error;
  }
};

export const markProductionOrdersAsProcessed = async (productionOrderIds) => {
  if (!Array.isArray(productionOrderIds) || productionOrderIds.length === 0) {
    throw new Error('No production order IDs provided.');
  }

  try {
    const pool = await poolPromise;

    const idList = productionOrderIds.map((id) => `'${id}'`).join(',');

    // Update production orders
    await pool.request().query(`
      UPDATE ProductionOrders
      SET status = 'processed'
      WHERE production_order_no IN (${idList});
    `);

    // Update journal lines
    await pool.request().query(`
      UPDATE ProductionJournalLines
      SET status = 'processed'
      WHERE production_order_no IN (${idList});
    `);

    console.log(`Successfully marked ${productionOrderIds.length} production orders and their journal lines as processed.`);
  } catch (error) {
    console.error(`Error marking production orders as processed: ${error.message}`);
    throw error;
  }
};


export const insertProductionOrder = async (order) => {
  try {
    const pool = await poolPromise;

    await pool.request()
      .input('production_order_no', pool.NVarChar, order.production_order_no)
      .input('ItemNo', pool.NVarChar, order.ItemNo)
      .input('Quantity', pool.Decimal(18, 4), order.Quantity)
      .input('uom', pool.NVarChar, order.uom)
      .input('LocationCode', pool.NVarChar, order.LocationCode)
      .input('BIN', pool.NVarChar, order.BIN || null)
      .input('user', pool.NVarChar, order.user)
      .input('line_no', pool.Int, order.line_no)
      .input('routing', pool.NVarChar, order.routing)
      .input('date_time', pool.DateTime, order.date_time)
      .input('status', pool.NVarChar, 'raw') // Default status
      .query(`
        INSERT INTO ProductionOrders (
          production_order_no, ItemNo, Quantity, uom, LocationCode, BIN, [user], line_no, routing, date_time, status
        )
        VALUES (
          @production_order_no, @ItemNo, @Quantity, @uom, @LocationCode, @BIN, @user, @line_no, @routing, @date_time, @status
        );
      `);

    console.log(`Inserted production order: ${order.production_order_no}`);
  } catch (error) {
    console.error(`Error inserting production order: ${error.message}`);
    throw error;
  }
};


export const insertProductionJournalLine = async (productionOrderNo, line) => {
  try {
    const pool = await poolPromise;

    await pool.request()
      .input('production_order_no', pool.NVarChar, productionOrderNo)
      .input('ItemNo', pool.NVarChar, line.ItemNo)
      .input('Quantity', pool.Decimal(18, 4), line.Quantity)
      .input('uom', pool.NVarChar, line.uom)
      .input('LocationCode', pool.NVarChar, line.LocationCode)
      .input('BIN', pool.NVarChar, line.BIN || null)
      .input('line_no', pool.Int, line.line_no)
      .input('type', pool.NVarChar, line.type)
      .input('date_time', pool.DateTime, line.date_time)
      .input('user', pool.NVarChar, line.user)
      .input('status', pool.NVarChar, 'raw') // Default status
      .query(`
        INSERT INTO ProductionJournalLines (
          production_order_no, ItemNo, Quantity, uom, LocationCode, BIN, line_no, [type], date_time, [user], status
        )
        VALUES (
          @production_order_no, @ItemNo, @Quantity, @uom, @LocationCode, @BIN, @line_no, @type, @date_time, @user, @status
        );
      `);

    console.log(`Inserted journal line for production order: ${productionOrderNo}, line_no: ${line.line_no}`);
  } catch (error) {
    console.error(`Error inserting production journal line: ${error.message}`);
    throw error;
  }
};
