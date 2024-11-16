import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up
import { transformData } from '../Transformers/transformer.js';
import fs from 'fs';
import {generateProductionOrderNo} from '../Utils/generators.js';
export const consumeBeheadingData = async () => {
    const queueName = 'production_data_order_beheading.bc';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'production_data_order_beheading.bc';
    const batchSize =1;
    const queueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'fcl.exchange.dlx',
            'x-dead-letter-routing-key': 'production_data_order_beheading.bc'
        }
    };

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        await channel.assertExchange(exchange, 'direct', { durable: true });
        await channel.assertQueue(queueName, queueOptions);
        await channel.bindQueue(queueName, exchange, routingKey);
        channel.prefetch(1);

        logger.info(`Waiting for up to ${batchSize} messages in queue: ${queueName}`);

        const messages = [];
        let batchResolve;

        // Batch promise to return the messages array
        const batchPromise = new Promise((resolve) => {
            batchResolve = resolve;
        });

        // Start consuming messages
        channel.consume(queueName, (msg) => {
            if (msg !== null) {
                try {
                    const beheadingData = JSON.parse(msg.content.toString());
                    logger.info(`Received beheading data: ${JSON.stringify(beheadingData)}`);
                    messages.push(transformData(beheadingData));  // Transform each message data
                    channel.ack(msg);

                    // Once we have 150 messages, resolve the promise
                   

                    if (messages.length >= batchSize) {
                        // sslogger.info('Final data: ');
                        const finalData = messages.flat().flat(); // Skip the first element
                       
                        batchResolve(finalData);
                    }
                } catch (parseError) {
                    logger.error(`Failed to parse message content: ${parseError.message}`);
                    channel.nack(msg, false, false); // Move to dead-letter queue
                }
            } else {
                logger.warn("Received null message");
            }
        }, { noAck: false });

        // Wait for the batch to be filled
        await batchPromise;

        // Cleanup and close the channel
        await channel.close();
        // await connection.close();

        return messages;
    } catch (error) {
        logger.error('Error consuming beheading data from RabbitMQ: ' + error.message);
        throw error;
    }
};





export const respondWithMockData = () =>  mockData;

const mockData = [
    {
        "production_order_no":generateProductionOrderNo(),
        // "production_order_no": "P00_16137X",
        "ItemNo": "G1243",
        "Quantity": 22.2,
        "uom": "KG",
        "LocationCode": "1570",
        "BIN": "",
        "user": "77",
        "line_no": 1000,
        "routing": "production_order.bc",
        "date_time": "2024-11-08T11:37:08.000Z",
        "ProductionJournalLines": [
            {
                "ItemNo": "G1243",
                "Quantity": 22.2,
                "uom": "KG",
                "LocationCode": "1570",
                "BIN": "",
                "line_no": 1000,
                "type": "output",
                "date_time": "2024-11-08T11:37:08.000Z",
                "user": "77"
            },
            {
                "ItemNo": "G0111",
                "Quantity": 22.2,
                "uom": "KG",
                "LocationCode": "1020",
                "BIN": "",
                "line_no": 2000,
                "type": "consumption",
                "date_time": "2024-11-08T11:37:08.000Z",
                "user": "77"
            }
        ]
    }
]

