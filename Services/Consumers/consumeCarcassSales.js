import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up
import { transformData } from '../Transformers/transformCarcassSales.js';
import fs from 'fs';

// export const consumeCarcassSalesData = async () => {
//     const queueName = 'production_data_order_beheading.bc';
//     const exchange = 'fcl.exchange.direct';
//     const routingKey = 'production_data_order_beheading.bc';
//     const batchSize =1;
//     const queueOptions = {
//         durable: true,
//         arguments: {
//             'x-dead-letter-exchange': 'fcl.exchange.dlx',
//             'x-dead-letter-routing-key': 'production_data_order_beheading.bc'
//         }
//     };

//     try {
//         const connection = await getRabbitMQConnection();
//         const channel = await connection.createChannel();

//         await channel.assertExchange(exchange, 'direct', { durable: true });
//         await channel.assertQueue(queueName, queueOptions);
//         await channel.bindQueue(queueName, exchange, routingKey);
//         channel.prefetch(1);

//         logger.info(`Waiting for up to ${batchSize} messages in queue: ${queueName}`);

//         const messages = [];
//         let batchResolve;

//         // Batch promise to return the messages array
//         const batchPromise = new Promise((resolve) => {
//             batchResolve = resolve;
//         });

//         // Start consuming messages
//         channel.consume(queueName, (msg) => {
//             if (msg !== null) {
//                 try {
//                     const beheadingData = JSON.parse(msg.content.toString());
//                     logger.info(`Received beheading data: ${JSON.stringify(beheadingData)}`);
//                     messages.push(transformData(beheadingData));  // Transform each message data
//                     channel.ack(msg);

//                     // Once we have 150 messages, resolve the promise
                   

//                     if (messages.length >= batchSize) {
//                         // sslogger.info('Final data: ');
//                         const finalData = messages.flat().flat(); // Skip the first element
                       
//                         batchResolve(finalData);
//                     }
//                 } catch (parseError) {
//                     logger.error(`Failed to parse message content: ${parseError.message}`);
//                     channel.nack(msg, false, false); // Move to dead-letter queue
//                 }
//             } else {
//                 logger.warn("Received null message");
//             }
//         }, { noAck: false });

//         // Wait for the batch to be filled
//         await batchPromise;

//         // Cleanup and close the channel
//         await channel.close();
//         // await connection.close();

//         return messages;
//     } catch (error) {
//         logger.error('Error consuming beheading data from RabbitMQ: ' + error.message);
//         throw error;
//     }
// };

export const consumeCarcassSalesData = async() => transformData(mockData);

const mockData = {
                        "product_code": "G1033",
                        "transfer_from_location": 1020,
                        "transfer_to_location": 3535,
                        "receiver_total_pieces": "1",
                        "receiver_total_weight": "10",
                        "production_date": "2024-11-13T21:00:00.000000Z",
                        "with_variance": 0,
                        "timestamp": "2024-11-14 11:59:23"
                  }