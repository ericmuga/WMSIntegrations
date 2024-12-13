import { processConfig } from './processConfig.js';
import { consumeRabbitMQ } from './consumer.js';


(async () => {
    const queueName = 'continentals.bc';
    const routingKey = 'continentals.bc';
    const sequence = processConfig.continentals;

    try {
        const productionOrders = await consumeRabbitMQ({
            queueName,
            routingKey,
            sequence,
            batchSize: 1, // Customize batch size
            timeout: 5000, // Customize timeout
        });

        // logger.info('Processed Production Orders:', JSON.stringify(productionOrders, null, 2));
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
})();
