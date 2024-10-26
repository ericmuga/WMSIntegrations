// fetchBOTOrders.js

import https from 'https';
import { BOT_ORDERS_URL } from '../config/default.js';
import logger from '../logger.js';

// Fetches data from the portal orders API
const fetchPortalOrders = async (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, {timeout: 10000 }, (res) => {
      let data = '';

      // Receive chunks of data
      res.on('data', (chunk) => {
        data += chunk;
      });

      // Handle end of response
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (error) {
          reject(new Error('Error parsing JSON response'));
        }
      });
    }).on('error', (err) => {
      reject(new Error(`Request failed: ${err.message}`));
    });
  });
};

// Groups orders by `ext_doc_no`
export const groupOrdersByExtDocNo = async () => {
  try {
    const data = await fetchPortalOrders(BOT_ORDERS_URL);
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
