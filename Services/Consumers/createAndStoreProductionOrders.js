import { insertProductionOrder, insertProductionJournalLine } from '../Utils/dbUtils.js'; // Define these helper functions for DB operations
import logger from '../../logger.js';
// import { consumeSlaughterData } from './Services/Consumers/consumeSlaughterDataQueue.js';
import { consumeBeheadingData} from './consumeBeheadingQueue.js';
import { consumeCarcassSales } from './consumeCarcassSales.js';
import { consumeBreakingData } from './consumeBreakingQueue.js';
import { consumeDeboningData } from './consumeDeboningQueue.js';
import { consumechoppingData } from './consumeChoppingData.js';
import { consume1570_2055 } from './consume1570_2055.js';
import {processSausageQueue } from './consumeSausages.js';
import { processButcheryPackingQueue } from './consume1570_3535.js';
import { processContinentalsQueue } from './consumeContinentals.js';


export const createAndStoreProductionOrders = async ({ date, item, production_order_no }) => {
  const cutoffDate = new Date('2025-01-06T00:00:00.000Z');

  const adjustDateTime = (order) => {
    if (new Date(order.date_time) < cutoffDate) {
      order.date_time = '2025-01-06T00:00:00.000Z';
    }
    if (order.ProductionJournalLines) {
      order.ProductionJournalLines = order.ProductionJournalLines.map((line) => {
        if (new Date(line.date_time) < cutoffDate) {
          line.date_time = '2025-01-06T00:00:00.000Z';
        }
        return line;
      });
    }
    return order;
  };

  try {
    const queues = [
    //   { name: 'beheading', processor: consumeBeheadingData },
    //   { name: 'carcass', processor: consumeCarcassSales },
    //   { name: 'breaking', processor: consumeBreakingData },
    //   { name: 'deboning', processor: consumeDeboningData },
    //   { name: 'mincing', processor: consume1570_2055 },
    //   { name: 'chopping', processor: consumechoppingData },
    //   { name: 'packing', processor: processButcheryPackingQueue },
    //   { name: 'sausage', processor: processSausageQueue },
      {name:'continentals',processor :processContinentalsQueue}
    ];

    for (const { name, processor } of queues) {
      try {
        const data = await processor();

        // Apply adjustments and filters
        const filteredData = data
          .map(adjustDateTime)
          .filter((order) => {
            if (date && !order.date_time.startsWith(date)) return false;
            if (item && order.ItemNo !== item) return false;
            if (production_order_no && order.production_order_no !== production_order_no) return false;
            return true;
          });

        // Insert each production order into the database
        for (const order of filteredData) {
          await insertProductionOrder(order);

          // Insert related journal lines
          for (const line of order.ProductionJournalLines) {
            await insertProductionJournalLine(order.production_order_no, line);
          }
        }

        logger.info(`Inserted ${filteredData.length} orders from ${name} queue into the database.`);
      } catch (error) {
        logger.error(`Error processing ${name} queue: ${error.message}`);
      }
    }
  } catch (error) {
    logger.error(`Error creating production orders: ${error.message}`);
    throw error;
  }
};

const startProcessing = () => {
  setInterval(async () => {
    try {
      logger.info('Starting production order processing...');
      await createAndStoreProductionOrders({});
      logger.info('Production order processing completed.');
    } catch (error) {
      logger.error(`Error in scheduled production order processing: ${error.message}`);
    }
  },  600); // 10 minutes in milliseconds
};

startProcessing();
