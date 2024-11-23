import { getRabbitMQConnection } from '../../config/default.js';
import logger from '../../logger.js'; // Assuming you have a logger module set up
export const consumechoppingData = async () => {
    const queueName = 'production_data_order_chopping.bc';
    const exchange = 'fcl.exchange.direct';
    const routingKey = 'production_data_order_chopping.bc';
    const batchSize = 10;
    const timeout = 5000; // Timeout in milliseconds (e.g., 5 seconds)
    const queueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'fcl.exchange.dlx',
            'x-dead-letter-routing-key': 'production_data_order_chopping.bc',
        },
    };

    try {
        const connection = await getRabbitMQConnection();
        const channel = await connection.createChannel();

        await channel.assertExchange(exchange, 'direct', { durable: true });
        await channel.assertQueue(queueName, queueOptions);
        await channel.bindQueue(queueName, exchange, routingKey);
        channel.prefetch(batchSize);

        logger.info(`Waiting for up to ${batchSize} messages in queue: ${queueName}`);

        const messages = [];
        let batchResolve;
        let batchTimeout;

        // Batch promise to return the messages array
        const batchPromise = new Promise((resolve) => {
            batchResolve = resolve;
        });

        // Set a timeout to resolve with an empty array if no messages are received
        batchTimeout = setTimeout(() => {
            if (messages.length === 0) {
                logger.info('No messages received within the timeout period');
                batchResolve([]);
            }
        }, timeout);

        // Start consuming messages
        channel.consume(
            queueName,
            (msg) => {
                if (msg !== null) {
                    try {
                        const choppingData = JSON.parse(msg.content.toString());
                        logger.info(`Received chopping data: ${JSON.stringify(choppingData)}`);
                        messages.push(transformData(choppingData)); // Transform each message data
                        channel.ack(msg);

                        if (messages.length >= batchSize) {
                            clearTimeout(batchTimeout); // Clear timeout if batch is filled
                            batchResolve(messages);
                        }
                    } catch (parseError) {
                        logger.error(`Failed to parse message content: ${parseError.message}`);
                        channel.nack(msg, false, false); // Move to dead-letter queue
                    }
                } else {
                    logger.warn('Received null message');
                }
            },
            { noAck: false }
        );

        // Wait for the batch to be filled or timeout
        const batch = await batchPromise;

        // Cleanup and close the channel
        await channel.close();

        return batch;
    } catch (error) {
        logger.error('Error consuming chopping data from RabbitMQ: ' + error.message);
        throw error;
    }
};

export const transformData = (input) => {
    const output = [];

    // Group data by chopping_id
    const grouped = input.reduce((acc, item) => {
        if (!acc[item.chopping_id]) {
            acc[item.chopping_id] = [];
        }
        acc[item.chopping_id].push(item);
        return acc;
    }, {});

    // Transform each group
    for (const [choppingId, items] of Object.entries(grouped)) {
        const productionOrder = {
            production_order_no: `P10_${choppingId}`, // Prefix chopping_id with P10
            ItemNo: items[0].item_code,
            Quantity: parseFloat(items[0].weight),
            uom: "KG", // Default unit of measure
            LocationCode: "1570", // Default location code
            BIN: "",
            user: "77", // Default user
            line_no: 1000,
            routing: "production_order.bc", // Default routing
            date_time: items[0].timestamp,
            ProductionJournalLines: items.map((item, index) => ({
                ItemNo: item.item_code,
                Quantity: parseFloat(item.weight),
                uom: "KG", // Default unit of measure
                LocationCode: "1570", // Default location code
                BIN: "",
                line_no: 1000 + index * 10, // Increment line_no for each line
                type: item.output === "1" ? "output" : "consumption",
                date_time: item.timestamp,
                user: "77", // Default user
            })),
        };

        output.push(productionOrder);
    }
    return output;
};

// Example invocation
consumechoppingData();
