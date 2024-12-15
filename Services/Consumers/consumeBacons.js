import { consumeRabbitMQ } from './consumer.js';


(async () => {
    const queueName = 'bacon.bc';
    const routingKey = 'bacon.bc';
    const finalProcess ='Salting' 

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
