// index.js

import express from 'express';
import logger from './logger.js';
// import { getRabbitMQConnection, rabbitmqConfig } from './config/default.js';
// import { generateProductionOrderData } from './Services/fetchProductionOrders.js';
import { generateOrders } from './Services/fetchPortalOrders.js';
import { groupOrdersByExtDocNo } from './Services/fetchBOTOrders.js';
import { generateTransferOrders } from './Services/transferOrderGenerator.js';
// import { generateSlaughterData } from './Services/fetchSlaughterLines.js';
// import { generateReceiptNo } from './Services/postReceipts.js'; 
import {generateInvoices} from './Services/fetchPortalInvoices.js'
import { sendSlaughterReceipt,sendProductionOrderError } from './RabbitMQService.js';

// import { isValidDate,isPositiveNumber,isNonEmptyString,validateOrder,validateLine } from './Services/helper.js';
import { consumeBeheadingData } from './Services/Consumers/consumeBeheadingQueue.js';
import { consumeSlaughterData } from './Services/Consumers/consumeSlaughterDataQueue.js';
import { printInit } from './Services/printerService.js'
import { consumeCarcassSalesData } from './Services/Consumers/consumeCarcassSales.js';
import { consumeBreakingData } from './Services/Consumers/consumeBreakingQueue.js';


const app = express();
app.use(express.json());

app.get('/fetch-beheading-data', async (req, res) => {
  const beheadingData = await consumeBeheadingData();
  // const beheadingData = 
  if (beheadingData) {
      res.json(beheadingData);
  } else {
      res.status(404).json({ error: 'No butchery data available.' });
  }
});

function mergeProductionOrders(arr1, arr2) {

  // Create a Map for quick lookup by production_order_no
  const mergedMap = new Map();

  // Add all orders from arr1 to the Map
  arr1.forEach(order => {
    mergedMap.set(order.production_order_no, { ...order });
  });

  // Merge orders from arr2 into the Map
  arr2.forEach(order2 => {
    if (mergedMap.has(order2.production_order_no)) {
      const existingOrder = mergedMap.get(order2.production_order_no);
      existingOrder.ProductionJournalLines.push(...order2.ProductionJournalLines);
    } else {
      mergedMap.set(order2.production_order_no, { ...order2 });
    }
  });

  // Convert the Map back to an array
  return Array.from(mergedMap.values());
}





app.get('/fetch-production-orders', async (req, res) => {
  try {
    const { date, item, production_order_no } = req.query;

    // Fetch all required datasets
    const [breakingData, beheadingData, carcassSales] = await Promise.all([
      consumeBreakingData(),
      consumeBeheadingData(),
      consumeCarcassSalesData(),
    ]);

    //Merge all datasets
    let productionOrders = mergeProductionOrders(beheadingData, carcassSales);
    productionOrders = mergeProductionOrders(productionOrders, breakingData);
    // let productionOrders =consumeBeheadingData();

    // Filter production orders based on query parameters
    const filters = {
      date: date && ((order) => order.date_time.startsWith(date)),
      item: item && ((order) => order.ItemNo === item),
      production_order_no: production_order_no && ((order) => order.production_order_no === production_order_no),
    };

    productionOrders = productionOrders.filter(order =>
      Object.values(filters)
        .filter(Boolean) // Remove undefined filters
        .every(filterFn => filterFn(order))
    );


    res.json(productionOrders.flat());
  } catch (error) {
    console.error('Error fetching production orders:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

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
  
  printInit(req.body)
  
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



app.post('/master-data', async (req, res) => {
  const { type, no } = req.body;

  logger.info(`Received master data : ${JSON.stringify(req.body)}`);
  if (!type || !no) {
    return res.status(400).send('Missing required fields: type, no');
  }

  try {
    await sendProductionOrderError(type, no);
    res.status(200).send('Master data sent successfully.');
  } catch (error) {
    res.status(500).send('Failed to send master data.');
  }
});


// Start the server
const port = 3000;
app.listen(port, () => {
  logger.info(`API running at http://localhost:${port}`);
});
