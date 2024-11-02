// index.js

import express from 'express';
import logger from './logger.js';
import { getRabbitMQConnection, rabbitmqConfig } from './config/default.js';
import { generateProductionOrderData } from './Services/fetchProductionOrders.js';
import { generateOrders } from './Services/fetchPortalOrders.js';
import { groupOrdersByExtDocNo } from './Services/fetchBOTOrders.js';
import { generateTransferOrders } from './Services/transferOrderGenerator.js';
import { generateSlaughterData } from './Services/fetchSlaughterLines.js';
import { generateReceiptNo } from './Services/postReceipts.js'; 
import {generateInvoices} from './Services/fetchPortalInvoices.js'
import { sendSlaughterReceipt,sendProductionOrderError,consumeSlaughterData } from './RabbitMQService.js';
import { isValidDate,isPositiveNumber,isNonEmptyString,validateOrder,validateLine } from './Services/helper.js';
import { consumeBeheadingData } from './Services/Consumers/consumeBeheadingQueue.js';
const app = express();
app.use(express.json());

app.get('/fetch-beheading-data', async (req, res) => {
  const beheadingData = await consumeBeheadingData();
  if (beheadingData) {
      res.json(beheadingData);
  } else {
      res.status(404).json({ error: 'No butchery data available.' });
  }
});



app.get('/fetch-production-orders', (req, res) => {

  const { date, item, production_order_no } = req.query;
  let productionOrders = generateProductionOrderData();

  if (date) {
    productionOrders = productionOrders.filter(order =>
      order.date_time.startsWith(date)
    );
  }

  if (item) {
    productionOrders = productionOrders.filter(order =>
      order.ItemNo === item
    );
  }

  if (production_order_no) {
    productionOrders = productionOrders.filter(order =>
      order.production_order_no === production_order_no
    );
  }

  res.json(productionOrders);
});

app.get('/fetch-portal-orders', (req, res) => res.json(generateOrders(3, 5)));
app.get('/fetch-portal-invoices', (req, res) => res.json(generateInvoices(3, 5)));
app.get('/fetch-bot-orders', async (req, res) => {
  try {
    const groupedOrders = await groupOrdersByExtDocNo();
    res.json(groupedOrders);
  } catch (error) {
    logger.error(`Error fetching BOT orders: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch BOT orders' });
  }
});

app.get('/fetch-transfer-orders', (req, res) => {
  const numOrders = parseInt(req.query.numOrders) || 3;
  const maxItemsPerOrder = parseInt(req.query.maxItemsPerOrder) || 5;

  const transferOrders = generateTransferOrders(numOrders, maxItemsPerOrder);
  res.json(transferOrders);
});

app.get('/fetch-slaughter-data', async (req, res) => {
  try {
      const slaughterData = await consumeSlaughterData();
      if (slaughterData) {
          res.json(slaughterData);
      } else {
          res.status(404).json({ message: 'No slaughter data available in queue.' });
      }
  } catch (error) {
      logger.error(`Error fetching slaughter data: ${error.message}`);
      res.status(500).json({ error: 'Failed to fetch slaughter data.' });
  }
});




app.post('/print-order', (req, res) => {
  logger.info(`Received print order request: ${JSON.stringify(req.body)}`);
  return res.status(201).json({ message: 'success' });
});


// POST endpoint to receive receipt data and respond with a new receipt_no
app.post('/submit-slaughter-receipt', async (req, res) => {
  const { routing, receiptLines } = req.body;

  if (!routing || !receiptLines || !Array.isArray(receiptLines) || receiptLines.length === 0) {
    return res.status(400).json({ error: 'Invalid request format or missing required data.' });
  }

  try {
    await sendSlaughterReceipt(routing, receiptLines);
    res.status(200).json({ message: 'Slaughter receipt sent successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send slaughter receipt.' });
  }
});

app.post('/production-order-error', async (req, res) => {
  const { errorMessage, orderNo } = req.body;

  if (!errorMessage || !orderNo) {
    return res.status(400).send('Missing required fields: errorMessage, orderNo');
  }

  try {
    await sendProductionOrderError(errorMessage, orderNo);
    res.status(200).send('Production order error sent successfully.');
  } catch (error) {
    res.status(500).send('Failed to send production order error.');
  }
});


// Start the server
const port = 3000;
app.listen(port, () => {
  logger.info(`API running at http://localhost:${port}`);
});
