// index.js

import express from 'express';
import logger from './logger.js';


import { generateOrders } from './Services/fetchPortalOrders.js';

import { groupOrdersByExtDocNo } from './Services/fetchBOTOrders.js';
import { generateTransferOrders } from './Services/transferOrderGenerator.js';
import {generateInvoices} from './Services/fetchPortalInvoices.js'
import { sendSlaughterReceipt,sendProductionOrderError } from './RabbitMQService.js';
import { consumeSlaughterData } from './Services/Consumers/consumeSlaughterDataQueue.js';
import { consumeBeheadingData} from './Services/Consumers/consumeBeheadingQueue.js';
import { consumeCarcassSales } from './Services/Consumers/consumeCarcassSales.js';
import { consumeBreakingData } from './Services/Consumers/consumeBreakingQueue.js';
import { consumeDeboningData } from './Services/Consumers/consumeDeboningQueue.js';
import { consumechoppingData } from './Services/Consumers/consumeChoppingData.js';
import { initPrinting } from './Services/printerService.js'
import { generateReturnOrders } from './Services/fetchReturnOrders.js';
import { fetchOrderLines } from './Services/fetchExecutedLines.js';
import { generateMtn,generateResponse } from './Services/QRCode.js';
import { consume1570_2055 } from './Services/Consumers/consume1570_2055.js';
import {processSausageQueue } from './Services/Consumers/consumeSausages.js';
import { pushToPickAndPack } from './Services/Utils/insertIntoPP.js';
import {processContinentalsQueue} from './Services/Consumers/consumeContinentals.js';
import { processButcheryPackingQueue } from './Services/Consumers/consume1570_3535.js';
import { getRawProductionOrders, markProductionOrdersAsProcessed } from './Services/Utils/dbUtils.js';
const app = express();
app.use(express.json());

app.get('/generate-mtn',async(req,res)=>{
  logger.info(`Received request to generate MTN`);
  res.json(generateResponse());
});



app.get('/fetch-executed-lines', async (req, res) => {
  const { order_no } = req.query; // Extract optional order_no parameter

  try {
    const salesLines = await fetchOrderLines(order_no); // Call the reusable function
    res.json(salesLines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.post('/post-shipment', (req, res) => {

  logger.info(`Received shipment data: ${JSON.stringify(req.body)}`);
  return res.status(201).json({ message: 'success' });
});

app.get('/fetch-return-orders', (req, res) => {
  const numOrders = parseInt(req.query.numOrders) || 3;
  const maxItemsPerOrder = parseInt(req.query.maxItemsPerOrder) || 5;

  // Directly extract query parameters without validation
  const filters = {
    customer: req.query.customer, // Customer filter
    shipment_date: req.query.shipment_date, // Shipment date filter
    salesperson: req.query.salesperson, // Salesperson filter
    load_to_code: req.query.load_to_code, // Ship-to code filter
    status: req.query.status || "Pending", // Default status
    rf_no_prefix: req.query.rf_no_prefix || "RF", // RF prefix
  };

  // Generate orders with filters
  const returnOrders = generateReturnOrders(numOrders, maxItemsPerOrder, filters);
  res.json(returnOrders);

});

// app.get('/fetch-production-orders', async (req, res) => {
//   const { date, item, production_order_no } = req.query;

//   const cutoffDate = new Date('2025-01-06T00:00:00.000Z');

//   const adjustDateTime = (order) => {
//     if (new Date(order.date_time) < cutoffDate) {
//       order.date_time = '2025-01-06T00:00:00.000Z';
//     }
//     if (order.ProductionJournalLines) {
//       order.ProductionJournalLines = order.ProductionJournalLines.map((line) => {
//         if (new Date(line.date_time) < cutoffDate) {
//           line.date_time = '2025-01-06T00:00:00.000Z';
//         }
//         return line;
//       });
//     }
//     return order;
//   };

//   try {
//     const productionOrders = [];
//     const queues = [
//       { name: 'beheading', processor: consumeBeheadingData },
//       { name: 'carcass', processor: consumeCarcassSales },
//       { name: 'breaking', processor: consumeBreakingData },
//       { name: 'deboning', processor: consumeDeboningData },
//       { name: 'mincing', processor: consume1570_2055 },
//       { name: 'chopping', processor: consumechoppingData },
//       { name: 'packing', processor: processButcheryPackingQueue },
//       // { name: 'sausage', processor: processSausageQueue },
//       // { name: 'continentals', processor: processContinentalsQueue },
//     ];

//     for (const { name, processor } of queues) {
//       try {
//         const data = await processor();

//         // Apply adjustments and filters
//         const filteredData = data
//           .map(adjustDateTime)
//           .filter((order) => {
//             if (date && !order.date_time.startsWith(date)) return false;
//             if (item && order.ItemNo !== item) return false;
//             if (production_order_no && order.production_order_no !== production_order_no) return false;
//             return true;
//           });

//         logger.info(`Processed ${filteredData.length} items from ${name} queue.`);
//         productionOrders.push(...filteredData);
//       } catch (error) {
//         logger.error(`Error processing ${name} queue: ${error.message}`);
//       }
//     }

//     // Respond with consolidated results
//     logger.info(`Returning ${productionOrders.length} production orders.`);
//     res.json(productionOrders.flat());
//   } catch (error) {
//     logger.error(`Error fetching production orders: ${error.message}`);
//     res.status(500).json({ error: 'Failed to fetch production orders.' });
//   }
// });

// import { getRawProductionOrders, markProductionOrdersAsProcessed } from './Services/productionOrderService.js';


// app.get('/fetch-production-orders', async (req, res) => {
//   const { date, item, production_order_no } = req.query;

//   try {
//     // Fetch production orders with status 'raw'
//     const productionOrders = await getRawProductionOrders({ date, item, production_order_no });

//     if (productionOrders.length === 0) {
//       logger.info('No raw production orders found.');
//       return res.json([]);
//     }

//     // Extract production_order_no for marking as processed
//     const productionOrderIds = productionOrders.map(order => order.production_order_no);

//     // Mark fetched production orders and their journal lines as processed
//     await markProductionOrdersAsProcessed(productionOrderIds);

//     logger.info(`Fetched and marked ${productionOrders.length} production orders as processed.`);
//     res.json(productionOrders);
//   } catch (error) {
//     logger.error(`Error fetching production orders: ${error.message}`);
//     res.status(500).json({ error: 'Failed to fetch production orders.' });
//   }
// });



app.get('/fetch-production-orders', async (req, res) => {
  const mergeProductionOrders = (...arrays) => arrays.flat();

  const { date, item, production_order_no } = req.query;

  const cutoffDate = new Date('2025-01-06T00:00:00.000Z');

  const adjustDateTime = (order) => {
    if (new Date(order.date_time) < cutoffDate) {
      order.date_time = '2025-01-06T00:00:00.000Z';
    }
    if (order.ProductionJournalLines) {
      order.ProductionJournalLines = order.ProductionJournalLines.map(line => {
        if (new Date(line.date_time) < cutoffDate) {
          line.date_time = '2025-01-06T00:00:00.000Z';
        }
        return line;
      });
    }
    return order;
  };

  try {
    // Consume data from queues
    const beheadingData = await consumeBeheadingData();
    const carcassSales = await consumeCarcassSales();
    const breakingData = await consumeBreakingData();
    const deboningData = await consumeDeboningData();
    // const mincingFromButchery = await consume1570_2055();
    // const choppingData = await consumechoppingData();
    // const consumeButcheryPackingData = await processButcheryPackingQueue();
    // const sausageData = await processSausageQueue();
    // const continentalsData = await processContinentalsQueue();

    let productionOrders = mergeProductionOrders(
          beheadingData,
          carcassSales,
          breakingData,
          deboningData,
          // mincingFromButchery,
          // choppingData

          // consumeButcheryPackingData,
          // sausageData,
          // continentalsData
    );

    // Filter by query parameters
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

    // Adjust date_time based on cutoff
    productionOrders = productionOrders.map(adjustDateTime);

    // logger.info(`Processed ${productionOrders.length} production orders.`);
    res.json(productionOrders.flat());
  } catch (error) {
    logger.error(`Error fetching production orders: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch production orders.' });
  }
});



app.get('/fetch-item-journals',async(req,res)=>{

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


app.post('/print-order', async (req,res) => {
  //console.log(req)
  logger.info(`Received print order request: ${JSON.stringify(req.body)}`);
  await pushToPickAndPack(req.body);
  initPrinting(req.body);
  return res.status(201).json({ message: 'success' });

});


app.post('/order-status', (req, res) => {
  logger.info(`Received order status update: ${JSON.stringify(req.body)}`);

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
const port = 4000;
app.listen(port, () => {
  logger.info(`API running at http://localhost:${port}`);
});
