

import { consumeRabbitMQ } from './consumer.js';

export const processButcheryPackingQueue = async () => {
   const queueName = 'transfer_from_1570_to_3535';
    const routingKey = 'transfer_from_1570_to_3535';
    const finalProcess = 'Packing';

    try {
        const productionOrders = await consumeRabbitMQ({
            queueName,
            routingKey,
            batchSize: 5, // Customize batch size
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


