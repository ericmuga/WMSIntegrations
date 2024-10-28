// index.js

import express from 'express';
import logger from './logger.js';
import { getRabbitMQConnection, rabbitmqConfig } from './config/default.js';
import { generateProductionOrderData } from './Services/fetchProductionOrders.js';
import { generateOrders } from './Services/fetchPortalOrders.js';
import { groupOrdersByExtDocNo } from './Services/fetchBOTOrders.js';
import { generateTransferOrders } from './Services/transferOrderGenerator.js';
import { generateSlaughterData } from './Services/fetchSlaughterLines.js';
import { generateReceiptNo } from './Services/postReceipts.js'; // Import the utility function for receipt numbers
import {generateInvoices} from './Services/fetchPortalInvoices.js'
import { sendSlaughterReceipt } from './RabbitMQService.js';
const app = express();
app.use(express.json());
// app.use(bodyParser.json());

app.post('/sendMessage', async (req, res) => {
  const item = req.body;

  try {
    const connection = getRabbitMQConnection();
    const channel = await connection.createChannel();

    const queue = 'item_modify_queue';
    const message = JSON.stringify(item);

    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(message));

    logger.info(` [x] Sent item: ${message}`);
    res.status(200).send(`success`);
  } catch (error) {
    logger.error('Error connecting to RabbitMQ: ' + error.message);
    res.status(500).send('Error connecting to RabbitMQ');
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

app.get('/fetch-slaughter-data', (req, res) => {
    // Optionally accept query parameters for custom generation
    const numReceipts = parseInt(req.query.numReceipts) || 3;
    const maxLinesPerReceipt = parseInt(req.query.maxLinesPerReceipt) || 5;
    const slaughterData = generateSlaughterData(numReceipts, maxLinesPerReceipt);
    res.json(slaughterData);
  });


  const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';
const isValidDate = (value) => !isNaN(Date.parse(value));
const isPositiveNumber = (value) => typeof value === 'number' && value > 0;

const validateLine = (line) => {
  return isPositiveNumber(line.line_no) &&
         isNonEmptyString(line.item_no) &&
         isNonEmptyString(line.item_description) &&
         isPositiveNumber(line.order_qty) &&
         isPositiveNumber(line.qty_base);
};

const validateOrder = (order) => {
  return isNonEmptyString(order.order_no) &&
         isNonEmptyString(order.ended_by) &&
         isNonEmptyString(order.customer_no) &&
         isNonEmptyString(order.customer_name) &&
         isValidDate(order.shp_date) &&
         order.lines.every(validateLine);
};

app.post('/print-order', (req, res) => {
  return res.status(201).json({message:'success'})
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
