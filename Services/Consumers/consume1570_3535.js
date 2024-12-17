import { processConfig } from './processConfig.js';
import { consumeRabbitMQ } from './consumer.js';


(async () => {
    const queueName = 'transfer_from_1570_to_3535';
    const routingKey = 'transfer_from_1570_to_3535';
    const sequence = processConfig.packing;

    try {
        const productionOrders = await consumeRabbitMQ({
            queueName,
            routingKey,
            sequence,
            batchSize: 5, // Customize batch size
            timeout: 5000, // Customize timeout
        });

        // logger.info('Processed Production Orders:', JSON.stringify(productionOrders, null, 2));
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
})();
