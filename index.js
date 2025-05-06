// index.js

import express from 'express';
import logger from './logger.js';


import { generateOrders } from './Services/fetchPortalOrders.js';
import { fetchGroupedOrdersWithIntegrity } from './Services/fetchBOTOrders.js';

import { generateTransferOrders } from './Services/transferOrderGenerator.js';
import {generateInvoices} from './Services/fetchPortalInvoices.js'
import { sendSlaughterReceipt,sendProductionOrderError } from './RabbitMQService.js';
import { consumeSlaughterData } from './Services/Consumers/consumeSlaughterDataQueue.js';
import { generateReturnOrders } from './Services/fetchReturnOrders.js';
import { fetchOrderLines } from './Services/fetchExecutedLines.js';
import { generateResponse } from './Services/QRCode.js';

import { fetchProductionOrdersFromQueue } from './Services/Utils/queueManager.js';
import axios from 'axios';
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



// GET /consume?limit=50 -> pulls from queue
app.get('/fetch-production-orders', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit || '150');
        const orders = await fetchProductionOrdersFromQueue(limit);
        res.json(orders );
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch orders.' });
    }
});


app.get('/fetch-item-journals',async(req,res)=>{

})

app.get('/fetch-portal-orders', (req, res) => res.json(generateOrders(3, 5)));
app.get('/fetch-portal-invoices', (req, res) => res.json(generateInvoices(3, 5)));


app.get('/fetch-bot-orders', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  fetchGroupedOrdersWithIntegrity({ query: { company: 'FCL', received_date: today } })
    .then((result) => res.json(result))
    .catch((error) => console.error('Error:', error.message));


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


app.post('/print-receipt', async (req,res) => {
   const response = await axios.post('http://100.100.4.51:3001/print-receipt', req.body);
        logger.info('Printing Cash office receipt.Response from external API:', response.data);
  return res.status(201).json({ message: 'success' });

});

// app.post('/print-delivery', async (req,res) => {
//   //console.log(req)
//   logger.info(`Received print delivery-note request: ${JSON.stringify(req.body)}`);
//   // await pushToPickAndPack(req.body);
//   // initPrinting(req.body);
//   return res.status(201).json({ message: 'success' });

// });





app.post('/:user/print-invoice', async (req, res) => {
  const { user } = req.params;

  try {
    switch (user) {
      case 'DWANGARI': {
        const response = await axios.post('http://100.100.4.49:3001/print-invoice', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }

      case 'JKIMANI': {
        const response = await axios.post('http://100.100.4.57:3001/print-invoice', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }

      case 'CM': {
        const response = await axios.post('http://100.100.4.61:3002/print-invoice', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }

      case 'CNJERI': {
        const response = await axios.post('http://100.100.4.57:3001/print-invoice', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }
       case 'JMATHENGE': {
        const response = await axios.post('http://100.100.4.56:3001/print-invoice', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }

      case 'EWANDIA': {
        const response = await axios.post('http://100.100.2.39:3001/print-invoice', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }

      case 'EMUGA': {
        const response = await axios.post('http://100.100.4.57:3001/print-invoice', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }

      case 'AMWAI': {
        const response = await axios.post('http://100.100.4.56:3001/print-invoice', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }
      
      case 'JMITWE': {
        const response = await axios.post('http://100.100.4.54:3001/print-invoice', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }

       case 'SMWAI': {
        const response = await axios.post('http://100.100.4.55:3001/print-invoice', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }

      case 'JMBAE': {
        const response = await axios.post('http://100.100.4.56:3001/print-invoice', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }

      case 'DWANZA': {
         //SEND AN INVOICE VIA EMAIL

        const response = await axios.post('http://100.100.2.54:3050/print-invoice', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }

      case 'SWANYEKI': {
         //SEND AN INVOICE VIA EMAIL

        const response = await axios.post('http://100.100.4.60:3002/print-invoice', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }
       
       

      case 'sales':
        logger.info(`Received print invoice request for sales: ${JSON.stringify(req.body)}`);
        break;

      default:
        logger.warn(`Unknown user type: ${user}`);
        return res.status(400).json({ error: 'Invalid user type' });
    }

    return res.status(200).json({ message: 'success' });

  } catch (err) {
    logger.error('Error posting invoice:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});




app.get('/qrcode*', async (req,res) => {
//response content type text/plain
  res.set('Content-Type', 'text/plain');

  return res.status(200).json({ message: 'success' });
})

app.post('/:user/print-delivery', async (req,res) => {


    const { user } = req.params;

    switch (user) { 
      case 'DWANGARI':{
                      const response=await axios.post('http://100.100.4.59:3001/print-delivery', req.body);
                       logger.info('Response from external API:', response.data);    
            break;}
    case 'JKIMANI':
                     { const response=await axios.post('http://100.100.4.57:3001/print-delivery', req.body);
                            logger.info('Response from external API:', response.data);
            break;}

      case 'CNJERI':
        {
          const response = await axios.post('http://100.100.4.57:3001/print-delivery', req.body);
          logger.info('Response from external API:', response.data);
          break;
        }
       case 'JMATHENGE': {
        const response = await axios.post('http://100.100.4.56:3001/print-delivery', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }

      case 'CM': {
        const response = await axios.post('http://100.100.4.61:3002/print-delivery', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }

      case 'EMUGA': {
        const response = await axios.post('http://100.100.4.57:3001/print-delivery', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }

      
      case 'JMBAE': {
        const response = await axios.post('http://100.100.4.56:3001/print-delivery', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }
      
      case 'JMITWE': {
        const response = await axios.post('http://100.100.4.54:3001/print-delivery', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }

       case 'SMWAI': {
        const response = await axios.post('http://100.100.4.55:3001/print-delivery', req.body);
        logger.info('Response from external API:', response.data);
        break;
      }

      case 'EWANDIA': {
          const response = await axios.post('http://100.100.2.39:3001/print-delivery', req.body);
          logger.info('Response from external API:', response.data);
          break;
        }


      case 'DWANZA': {

        //SEND DELIVERY VIA EMAIL
        
          const response = await axios.post('http://100.100.2.54:3050/print-delivery', req.body);
          logger.info('Response from external API:', response.data);
          break;
        }
         case 'SWANYEKI': {

        //SEND DELIVERY VIA EMAIL
        
          const response = await axios.post('http://100.100.4.60:3002/print-delivery', req.body);
          logger.info('Response from external API:', response.data);
          break;
        }



        
      case 'sales':
        logger.info(`Received print delivery request for sales: ${JSON.stringify(req.body)}`);
        break;

      default:
        logger.warn(`Unknown user type: ${user}`);
        return res.status(400).json({ error: 'Invalid user type' });
    }




  //console.log(req)
  logger.info(`Received print invoice request: ${JSON.stringify(req.body)}`);
  // await pushToPickAndPack(req.body);
  // initPrinting(req.body);
  return res.status(201).json({ message: 'success' });

});

app.post('/print-order', async (req,res) => {
  //console.log(req)
  logger.info(`Received print order request: ${JSON.stringify(req.body)}`);
//call external API
   await axios.post('http://100.100.2.39:3001/print-order', req.body)
  .then(response => {
    logger.info('Response from external API:', response.data);
  })
  return res.status(201).json({ message: 'success' });

});

  app.post('/print-order-cm', async (req,res) => {
  //console.log(req)
  logger.info(`Received print order request: ${JSON.stringify(req.body)}`);
//call external API
   await axios.post('http://100.100.4.61:3002/print-order', req.body)
  .then(response => {
    logger.info('Response from external API:', response.data);
  })
   return res.status(201).json({ message: 'success' });

});
  // await pushToPickAndPack(req.body);
  // initPrinting(req.body);
 

app.post('/print-order-export', async (req,res) => {
  //console.log(req)
  logger.info(`Received print order request: ${JSON.stringify(req.body)}`);
//call external API
   await axios.post('http://100.100.4.52:3001/print-order', req.body)
  .then(response => {
    logger.info('Response from external API:', response.data);
  })

  // await pushToPickAndPack(req.body);
  // initPrinting(req.body);
  return res.status(201).json({ message: 'success' });

});

app.post('/print-cheque', async (req,res) => {
  //console.log(req)
  logger.info(`Received print cheque request: ${JSON.stringify(req.body)}`);
//call external API
   await axios.post('http://100.100.4.50:3001/print-cheque', req.body)
  .then(response => {
    logger.info('Response from external API:', response.data);
  })
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
const port = 3001;
app.listen(port, () => {
  logger.info(`API running at http://localhost:${port}`);
});
