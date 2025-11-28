// src/services/inventoryCache.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JSON file that holds the cached inventory
const INVENTORY_FILE_PATH = path.join(__dirname, '..', '..', 'inventory-cache.json');

// In-memory cache to avoid reading disk on every request
let cache = null;

/**
 * Structure of the cache JSON:
 * {
 *   "lastRefresh": "2025-11-27T08:00:00.000Z",
 *   "items": {
 *     "ITEM-001": {
 *       "shops": {
 *         "MAIN": {
 *           "available": 95
 *         },
 *         "SHOP2": {
 *           "available": 10
 *         }
 *       }
 *     }
 *   }
 * }
 */

// Load cache from disk (or initialize empty)
async function loadCache() {
  if (cache) return cache;

  try {
    const raw = await fs.readFile(INVENTORY_FILE_PATH, 'utf8');
    cache = JSON.parse(raw);
  } catch (err) {
    // File may not exist first time; initialize
    cache = {
      lastRefresh: null,
      items: {}
    };
  }
  return cache;
}

async function saveCache() {
  if (!cache) return;
  const data = JSON.stringify(cache, null, 2);
  await fs.writeFile(INVENTORY_FILE_PATH, data, 'utf8');
}

/**
 * Stub: query Business Central for current inventory per item & shop.
 * You will replace this with actual OData/REST calls to BC.
 *
 * Expected return shape:
 * [
 *   { itemNo: 'ITEM-001', shopCode: 'MAIN', available: 100 },
 *   { itemNo: 'ITEM-002', shopCode: 'MAIN', available: 50 },
 *   { itemNo: 'ITEM-002', shopCode: 'SHOP2', available: 20 }
 * ]
 */
async function queryBusinessCentralInventory() {
  // TODO: replace with real BC calls
  // For now, return some dummy data for testing
  return [
    { itemNo: 'ITEM-001', shopCode: 'MAIN', available: 100 },
    { itemNo: 'EXP-100', shopCode: 'MAIN', available: 10 },
    { itemNo: 'ITEM-002', shopCode: 'SHOP2', available: 20 }
  ];
}

/**
 * Refresh cache from Business Central.
 * This is your "start of day / final" refresh.
 * You can wire an endpoint or a scheduled job (node-cron) to call this.
 */
export async function refreshInventoryFromBusinessCentral() {
  const bcData = await queryBusinessCentralInventory();
  cache = {
    lastRefresh: new Date().toISOString(),
    items: {}
  };

  for (const row of bcData) {
    const { itemNo, shopCode, available } = row;
    if (!cache.items[itemNo]) {
      cache.items[itemNo] = { shops: {} };
    }
    cache.items[itemNo].shops[shopCode] = {
      available: available
    };
  }

  await saveCache();
  return cache;
}

/**
 * Get current snapshot of inventory from cache.
 * Used by website to show items available for ordering.
 */
export async function getInventorySnapshot() {
  const c = await loadCache();
  return c;
}

/**
 * Get available qty for given item & shop from cache.
 */
async function getAvailableQty(itemNo, shopCode) {
  const c = await loadCache();
  const item = c.items[itemNo];
  if (!item) return 0;
  const shop = item.shops[shopCode];
  if (!shop) return 0;
  return shop.available ?? 0;
}

/**
 * Set available qty for given item & shop in cache.
 */
async function setAvailableQty(itemNo, shopCode, newQty) {
  const c = await loadCache();
  if (!c.items[itemNo]) {
    c.items[itemNo] = { shops: {} };
  }
  c.items[itemNo].shops[shopCode] = {
    available: newQty
  };
}

/**
 * Decide which shop to use for stock.
 * For now we use pickupDetails.locationCode, or 'MAIN' as default.
 */
function getShopCodeForOrder(order) {
  return order?.pickupDetails?.locationCode || 'MAIN';
}

/**
 * Reserve stock for an order BEFORE confirming it.
 * Throws an error if there is not enough available qty.
 *
 * - Decrements inventory-cache.json
 * - Used by POST /sales-orders
 */
export async function reserveStockForOrder(order) {
  const shopCode = getShopCodeForOrder(order);
  const lines = Array.isArray(order.lines) ? order.lines : [];

  // 1) Check all items have enough stock
  for (const line of lines) {
    if (!line || !line.itemNo || !line.quantity) continue;
    const available = await getAvailableQty(line.itemNo, shopCode);
    if (available < line.quantity) {
      const err = new Error(
        `Insufficient stock for item ${line.itemNo} at shop ${shopCode}. Available: ${available}, requested: ${line.quantity}`
      );
      err.code = 'OUT_OF_STOCK';
      err.itemNo = line.itemNo;
      err.shopCode = shopCode;
      err.available = available;
      err.requested = line.quantity;
      throw err;
    }
  }

  // 2) Deduct quantities
  for (const line of lines) {
    if (!line || !line.itemNo || !line.quantity) continue;
    const available = await getAvailableQty(line.itemNo, shopCode);
    const newQty = available - line.quantity;
    await setAvailableQty(line.itemNo, shopCode, newQty);
  }

  await saveCache();

  return true;
}
