import {processProductionOrders } from './queueProcessor.js';

import { consumeRabbitMQ } from './consumer.js';


(async () => {
    const queueName = 'sausages.bc';
    const routingKey = 'sausages.bc';
    const finalProcess ='Stuffing' 

    try {
        const productionOrders = await consumeRabbitMQ({
            queueName,
            routingKey,
            batchSize: 1, // Customize batch size
            timeout: 5000, // Customize timeout
            finalProcess
        });

        // logger.info('Processed Production Orders:', JSON.stringify(productionOrders, null, 2));
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
})();
