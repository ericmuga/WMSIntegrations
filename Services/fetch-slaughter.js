import 'dotenv/config';
import express from 'express';
import sql from 'mssql';
import cors from 'cors';
import basicAuth from 'express-basic-auth';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic Authentication Middleware
if (process.env.API_USER && process.env.API_PASSWORD) {
  app.use(basicAuth({
    users: { [process.env.API_USER]: process.env.API_PASSWORD },
    challenge: true,
    unauthorizedResponse: () => 'Unauthorized access'
  }));
}

// Database configuration
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
   // trustServerCertificate: process.env.NODE_ENV !== 'production'
  }
};

// Create a connection pool
const pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect();

// API endpoint to get invoice data with pagination and date filtering
app.get('/api/invoices', async (req, res) => {
  try {
    await poolConnect;

    const {
      page = 1,
      pageSize = 100,
      startDate = new Date(Date.now() - 15*24*3600*1000),
      endDate = null
    } = req.query;

    const pg  = parseInt(page);
    const ps  = parseInt(pageSize);
    const off = (pg - 1) * ps;

    // Build the WHERE clause dynamically
    const whereClauses = ['b.[created_at] >= @startDate'];
    if (endDate) whereClauses.push('b.[created_at] <= @endDate');
    const whereSql = whereClauses.join(' AND ');

    // First request: data
    const dataReq = pool.request()
      .input('startDate', sql.DateTime, new Date(startDate))
      .input('offset',    sql.Int, off)
      .input('pageSize',  sql.Int, ps);
    if (endDate) dataReq.input('endDate', sql.DateTime, new Date(endDate));

    const dataQuery = `
      ;WITH OrderedRows AS (
        SELECT
          UPPER(b.invoice_no)           AS extdocno,
          a.id                          AS line_no,
          'C00600'                      AS cust_no,
          CONVERT(DATE, b.created_at)   AS invoice_date,
          b.shop_code                   AS salesperson_code,
          ''                             AS ship_to_code,
          a.item_code,
          a.qty,
          'STR002'                      AS location_code,
          ''                             AS uom,
          a.price,
          ''                             AS ship_to_name,
          ISNULL(totSum.total, 0)       AS order_total,
          ISNULL(a.total, 0)            AS line_total,
          ISNULL(totQty.qtySum, 0)      AS order_qty,
          2                              AS record_type,
          0                              AS executed,
          0                              AS posted,
          0                              AS blocked_status,
          0                              AS revert_flag,
          b.cu_invoice_no,
          b.cu_no,
          b.sign_time,
          ROW_NUMBER() OVER (ORDER BY b.created_at DESC) AS rn
        FROM orders.dbo.shop_order_items AS a
        INNER JOIN orders.dbo.shop_invoices   AS b ON a.order_id = b.order_no
        LEFT JOIN (
          SELECT order_id, SUM(total)   AS total
          FROM orders.dbo.shop_order_items
          GROUP BY order_id
        ) AS totSum ON totSum.order_id = a.order_id
        LEFT JOIN (
          SELECT order_id, SUM(qty)     AS qtySum
          FROM orders.dbo.shop_order_items
          GROUP BY order_id
        ) AS totQty ON totQty.order_id = a.order_id
        WHERE ${whereSql}
      )
      SELECT *
      FROM OrderedRows
      WHERE rn BETWEEN @offset + 1 AND @offset + @pageSize
      ORDER BY rn
    `;

    // Second request: count
    const countReq = pool.request()
      .input('startDate', sql.DateTime, new Date(startDate));
    if (endDate) countReq.input('endDate', sql.DateTime, new Date(endDate));

    const countQuery = `
      SELECT COUNT(*) AS totalCount
      FROM orders.dbo.shop_order_items AS a
      INNER JOIN orders.dbo.shop_invoices   AS b ON a.order_id = b.order_no
      WHERE ${whereSql}
    `;

    // Execute in parallel
    const [ dataResult, countResult ] = await Promise.all([
      dataReq.query(dataQuery),
      countReq.query(countQuery)
    ]);

    res.json({
      data: dataResult.recordset,
      pagination: {
        page:       pg,
        pageSize:   ps,
        totalCount: countResult.recordset[0].totalCount,
        totalPages: Math.ceil(countResult.recordset[0].totalCount / ps)
      }
    });
  } catch (err) {
    console.error('SQL error:', err);
    res.status(500).json({ 
      error: 'Database error', 
      details: process.env.NODE_ENV === 'development' ? {
        message: err.message,
        code:    err.code,
        sqlInfo: err.originalError?.info
      } : undefined
    });
  }
});


app.get('/api/slaughter-data', async (req, res) => {
  try {
    await poolConnect;

    const { page = 1, pageSize = 100 } = req.query;
    const pg  = parseInt(page,   10);
    const ps  = parseInt(pageSize,10);
    const off = (pg - 1) * ps;

    const dataReq = pool.request()
      .input('offset',   sql.Int, off)
      .input('pageSize', sql.Int, ps);

    const dataQuery = `
      ;WITH OrderedSlaughters AS (
        SELECT
          a.id                         AS id,
          0                            AS missing_slapmark,
          a.item_code                  AS item_code,
          a.total_net                  AS total_net,
          0                            AS meat_percent,
          a.classification_code        AS classification_code,
          CAST(a.created_at AS date)   AS slaughter_date,
          a.receipt_no                 AS receipt_no,
          0                            AS slap_mark,
          b.username                   AS username,
          CAST(a.created_at AS time)   AS slaughter_time,
          GETDATE()                    AS import_time,
          0                            AS promoted_to_slaughter,
          ROW_NUMBER() OVER (ORDER BY a.created_at DESC) AS rn
        FROM 
          OPENQUERY([FCL-WMS], 
            'SELECT id,item_code,total_net,classification_code,created_at,receipt_no,user_id
             FROM [cml-calibra].dbo.slaughter_data'
          ) AS a
        INNER JOIN
          OPENQUERY([FCL-WMS],
            'SELECT id,username
             FROM [cml-calibra].dbo.users'
          ) AS b
          ON a.user_id = b.id
      )
      SELECT *
      FROM OrderedSlaughters
      WHERE rn BETWEEN @offset + 1 AND @offset + @pageSize
      ORDER BY rn;
    `;

    const countReq = pool.request();
    const countQuery = `
      SELECT COUNT(*) AS totalCount
      FROM OPENQUERY([FCL-WMS], 
        'SELECT id
         FROM [cml-calibra].dbo.slaughter_data'
      ) AS a;
    `;

    const [ dataResult, countResult ] = await Promise.all([
      dataReq.query(dataQuery),
      countReq.query(countQuery)
    ]);

    res.json({
      data: dataResult.recordset,
      pagination: {
        page:       pg,
        pageSize:   ps,
        totalCount: countResult.recordset[0].totalCount,
        totalPages: Math.ceil(countResult.recordset[0].totalCount / ps)
      }
    });
  } catch (err) {
    console.error('SQL error:', err);
    res.status(500).json({
      error: 'Database error',
      details: process.env.NODE_ENV === 'development' ? {
        message: err.message,
        code:    err.code,
        sqlInfo: err.originalError?.info
      } : undefined
    });
  }
});



app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  await pool.close();
  process.exit();
});
