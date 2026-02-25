// src/server.js
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yaml';

import {
  determineCompaniesFromOrder
} from './config/companyRouting.js';

import {
  reserveStockForOrder,
  getInventorySnapshot,
  refreshInventoryFromBusinessCentral
} from './services/inventoryCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Basic config
const PORT = process.env.APIDOC_PORT || 3000;
const API_KEY = process.env.API_KEY || 'changeme';

// Parse JSON bodies
app.use(express.json());

// --- Load Swagger spec ---
const swaggerFilePath = path.join(__dirname, '..', 'swagger.yaml');
const swaggerFile = fs.readFileSync(swaggerFilePath, 'utf8');
const swaggerDocument = yaml.parse(swaggerFile);

// Swagger UI at /docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// --- Simple API key auth middleware (matches X-API-Key in spec) ---
function apiKeyAuth(req, res, next) {
  const key = req.header('X-API-Key');
  if (!key || key !== API_KEY) {
    return res.status(401).json({
      traceId: cryptoRandomString(),
      code: 'UNAUTHORIZED',
      message: 'Invalid or missing API key.'
    });
  }
  next();
}

// Apply auth to all /api routes
app.use('/api', apiKeyAuth);

// --- In-memory storage for demo purposes ---
/**
 * orders: Map keyed by externalOrderNo
 * value example:
 * {
 *   request: <original request body>,
 *   bcOrders: [
 *     { company: 'MAIN CO', bcDocumentType: 'Order', bcDocumentNo: 'SO-000001', status: 'Created' },
 *     { company: 'EXPORT CO', bcDocumentType: 'Order', bcDocumentNo: 'SO-000002', status: 'Created' }
 *   ],
 *   status: 'Created',
 *   lastUpdatedAt: <ISO string>
 * }
 */
const orders = new Map();
let bcDocCounter = 1;

// Helper to fake BC document number
function generateBcDocumentNo() {
  const padded = String(bcDocCounter).padStart(6, '0');
  bcDocCounter += 1;
  return `SO-${padded}`;
}

function cryptoRandomString() {
  // tiny random string generator just for trace IDs
  return Math.random().toString(36).substring(2, 12);
}

// --- Routes matching swagger.yaml ---

// POST /api/v1/sales-orders
app.post('/api/v1/sales-orders', async (req, res) => {
  const traceId = cryptoRandomString();
  const body = req.body || {};
  const externalOrderNo = body.externalOrderNo;

  if (!externalOrderNo) {
    return res.status(400).json({
      traceId,
      code: 'VALIDATION_ERROR',
      message: 'externalOrderNo is required.',
      details: [
        {
          field: 'externalOrderNo',
          message: 'This field is required.'
        }
      ]
    });
  }

  // idempotency: if exists, just return existing info
  if (orders.has(externalOrderNo)) {
    const existing = orders.get(externalOrderNo);
    return res.status(200).json({
      externalOrderNo,
      status: existing.status,
      bcOrders: existing.bcOrders,
      warnings: ['Order already existed, returning existing record.']
    });
  }

  // 1) Check and reserve stock from local cache
  try {
    await reserveStockForOrder(body);
  } catch (err) {
    if (err.code === 'OUT_OF_STOCK') {
      return res.status(409).json({
        traceId,
        code: 'OUT_OF_STOCK',
        message: err.message,
        details: [
          {
            field: 'lines',
            message: `Item ${err.itemNo} at shop ${err.shopCode} has only ${err.available} available, requested ${err.requested}.`
          }
        ]
      });
    }

    console.error('Error reserving stock:', err);
    return res.status(500).json({
      traceId,
      code: 'INVENTORY_ERROR',
      message: 'An error occurred while reserving stock.'
    });
  }

  // 2) INTERNAL: decide which companies to create orders in
  const companies = determineCompaniesFromOrder(body);

  // 3) For demo: generate a fake BC order per company
  const bcOrders = companies.map((company) => ({
    company,
    bcDocumentType: 'Order',
    bcDocumentNo: generateBcDocumentNo(),
    status: 'Created'
  }));

  const now = new Date().toISOString();

  orders.set(externalOrderNo, {
    request: body,
    bcOrders,
    status: 'Created',
    lastUpdatedAt: now
  });

  // 4) In a real implementation, here is where you would:
  //    - Call Business Central to create actual orders
  //    - If BC fails, you may need to "roll back" the reserved stock

  return res.status(201).json({
    externalOrderNo,
    status: 'Created',
    bcOrders,
    warnings: []
  });
});

// GET /api/v1/sales-orders/:externalOrderNo
app.get('/api/v1/sales-orders/:externalOrderNo', (req, res) => {
  const traceId = cryptoRandomString();
  const { externalOrderNo } = req.params;

  if (!orders.has(externalOrderNo)) {
    return res.status(404).json({
      traceId,
      code: 'NOT_FOUND',
      message: 'No order found for the given externalOrderNo.'
    });
  }

  const order = orders.get(externalOrderNo);

  return res.status(200).json({
    externalOrderNo,
    status: order.status,
    lastUpdatedAt: order.lastUpdatedAt,
    bcOrders: order.bcOrders,
    errorMessage: null
  });
});

// --- Inventory endpoints ---

// GET /api/v1/items/availability
// Used by website to display items & current "available for web" qty
app.get('/api/v1/items/availability', async (req, res) => {
  const snapshot = await getInventorySnapshot();
  res.json(snapshot);
});

// POST /api/v1/inventory/refresh
// Trigger a refresh from Business Central (start of day / new stock)
// You can lock this down further (e.g. internal-only key)
app.post('/api/v1/inventory/refresh', async (req, res) => {
  const traceId = cryptoRandomString();
  try {
    const snapshot = await refreshInventoryFromBusinessCentral();
    res.json({
      traceId,
      message: 'Inventory refreshed from Business Central.',
      snapshot
    });
  } catch (err) {
    console.error('Error refreshing inventory from BC:', err);
    res.status(500).json({
      traceId,
      code: 'BC_REFRESH_ERROR',
      message: 'Failed to refresh inventory from Business Central.'
    });
  }
});

// Root: redirect to docs
app.get('/', (req, res) => {
  res.redirect('/docs');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Swagger UI available at http://localhost:${PORT}/docs`);
});
