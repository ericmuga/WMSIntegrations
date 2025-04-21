// fetchBOTOrders.js

import https from 'https';
import logger from '../logger.js';
import { buildBotOrdersUrl } from '../config/default.js';
// import { fetchPortalOrders } from './fetchBOTOrders.js';
import { getLastFetchedLine, setLastFetchedLine } from './rabbitMQPortalTracker.js'; // see below

// Groups orders by `ext_doc_no`
export const groupOrdersByExtDocNo = async () => {
  try {
    const data = await fetchPortalOrders(process.env.BOT_ORDERS_URL);
    const ordersMap = {};

    // Group items by `ext_doc_no`
    data.forEach((item) => {
      const {
        ext_doc_no,
        company,
        cust_no,
        cust_spec,
        shp_code,
        shp_date,
        sp_code,
        uom_code,
        item_no,
        item_spec,
        line_no,
        quantity,
      } = item;

      if (!ordersMap[ext_doc_no]) {
        ordersMap[ext_doc_no] = {
          ext_doc_no,
          company,
          cust_no,
          cust_spec,
          shp_code,
          shp_date,
          sp_code,
          order_lines: [],
        };
      }

      ordersMap[ext_doc_no].order_lines.push({
        item_no,
        item_spec,
        line_no,
        quantity,
        uom_code,
      });
    });

    return Object.values(ordersMap);
  } catch (error) {
    logger.error(`Error grouping orders by ext_doc_no: ${error.message}`);
    throw error;
  }
};

export const fetchBOTOrders = async (options) => {
  const url = buildBotOrdersUrl(options);

  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch {
          reject(new Error('Error parsing JSON response'));
        }
      });
    }).on('error', (err) => {
      reject(new Error(`Request failed: ${err.message}`));
    });
  });
};

export const fetchGroupedOrdersWithIntegrity = async (req) => {
  const company = req.query.company || 'FCL';
  const receivedDate = req.query.received_date || new Date().toISOString().split('T')[0];
  const apiKey = process.env.BOT_ORDERS_KEY;

  let from = await getLastFetchedLine(receivedDate) || 1;
  const batchSize = 100;

  let to = from + batchSize - 1;
  const fetched = await fetchBOTOrders({ apiKey, company, receivedDate, from, to });

  if (!fetched.length) return [];

  const lastExtDocNo = fetched[fetched.length - 1].ext_doc_no;
  const extDocOccurrences = fetched.filter(item => item.ext_doc_no === lastExtDocNo);

  let trimmedFetched = [...fetched];

  // 🧠 Check if the last order is incomplete AND not the only order
  const allOrders = [...new Set(fetched.map(i => i.ext_doc_no))];

  if (
    allOrders.length > 1 &&
    extDocOccurrences.length &&
    parseInt(extDocOccurrences[extDocOccurrences.length - 1].line_no) === to
  ) {
    // Trim last order if it's not the only one
    trimmedFetched = fetched.filter(item => item.ext_doc_no !== lastExtDocNo);
    to = Math.max(...trimmedFetched.map(i => parseInt(i.line_no))); // safely update last line
  }

  const grouped = groupOrders(trimmedFetched);
  await setLastFetchedLine(receivedDate, to + 1);

  return grouped;
};


// Same grouping logic as before
const groupOrders = (data) => {
  const ordersMap = {};
  data.forEach((item) => {
    const {
      ext_doc_no, company, cust_no, cust_spec, shp_code,
      shp_date, sp_code, uom_code, item_no, item_spec, line_no, quantity,
    } = item;

    if (!ordersMap[ext_doc_no]) {
      ordersMap[ext_doc_no] = {
        ext_doc_no,
        company,
        cust_no,
        cust_spec,
        shp_code,
        shp_date,
        sp_code,
        order_lines: [],
      };
    }

    ordersMap[ext_doc_no].order_lines.push({
      item_no,
      item_spec,
      line_no,
      quantity,
      uom_code,
    });
  });
  return Object.values(ordersMap);
};

