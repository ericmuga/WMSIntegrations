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
import { printInit } from './Services/printerService.js'
import { generateReturnOrders } from './Services/fetchReturnOrders.js';
import { fetchOrderLines } from './Services/fetchExecutedLines.js';
import { generateMtn,generateResponse } from './Services/QRCode.js';
import { consume1570_2055 } from './Services/Consumers/consume1570_2055.js';
import { consume2055_3535 } from './Services/Consumers/consume2055_3535.js';
import { consume2055_3600 } from './Services/Consumers/consume2055_3600.js';


const app = express();
app.use(express.json());

app.get('/generate-mtn',async(req,res)=>{
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


app.get('/fetch-production-orders', async (req, res) => {
  
     const mergeProductionOrders = (...arrays) => arrays.flat();
     const { date, item, production_order_no } = req.query;
     let beheadingData= await consumeBeheadingData();
    //  let carcassSales=await consumeCarcassSales(); 
     let breakingData= await consumeBreakingData();
     let deboningData= await consumeDeboningData();
     let mincingFromButchery= await consume1570_2055();
    //  let choppingData=await consumechoppingData();
    
    // let localSausageTransfers =await consume2055_3535();
    // let exportSausageTransfers =await consume2055_3600();

     let productionOrders = mergeProductionOrders(

                                                    beheadingData,
                                                    // carcassSales,
                                                    breakingData,
                                                    deboningData,
                                                    mincingFromButchery,
                                                    // choppingData,
                                                    // localSausageTransfers,
                                                    // exportSausageTransfers

                                                  );
    //  let productionOrders = breakingData;
     
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

      res.json(productionOrders.flat());
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


app.post('/print-order', (req,res) => {
  //console.log(req)
  logger.info(`Received print order request: ${JSON.stringify(req.body)}`);
  printInit(req.body);
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
const port = 3000;
app.listen(port, () => {
  logger.info(`API running at http://localhost:${port}`);
});
