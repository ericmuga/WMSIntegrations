import { consumeRabbitMQ } from './consumer.js';

export const processContinentalsQueue = async () => {
    const queueName = 'continentals.bc';
    const routingKey = 'continentals.bc';
    const finalProcess = 'Stuffing';

    try {
        const productionOrders = await consumeRabbitMQ({
            queueName,
            routingKey,
            batchSize: 1, // Customize batch size
            timeout: 1000, // Customize timeout
            finalProcess
        });

        console.log('Processed Production Orders:', JSON.stringify(productionOrders, null, 2));
        return productionOrders; // Return results for further use
    } catch (error) {
        console.error(`Error: ${error.message}`);
        throw error; // Rethrow for higher-level handling
    }
};

// Uncomment below to run directly
// (async () => {
//     await processContinentalsQueue();
// })();
