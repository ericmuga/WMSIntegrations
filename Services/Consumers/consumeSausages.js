
import { consumeRabbitMQ } from './consumer.js';

export const processSausageQueue = async () => {
    const queueName = 'sausages.bc';
    const routingKey = 'sausages.bc';
    const finalProcess = 'Stuffing';

    try {
        const productionOrders = await consumeRabbitMQ({
            queueName,
            routingKey,
            batchSize: 1, // Customize batch size
            timeout: 10000, // Customize timeout
            finalProcess
        });

        console.log('Processed Production Orders:', JSON.stringify(productionOrders, null, 2));
        return productionOrders; // Return results for further use
    } catch (error) {
        console.error(`Error: ${error.message}`);
        throw error; // Rethrow for handling at higher levels
    }
};

// Uncomment below to run directly
// (async () => {
//     await processSausageQueue();
// })();
