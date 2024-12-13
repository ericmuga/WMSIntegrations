import processConfig from './processConfig';
import { consumeRabbitMQ } from './consumer';

(async () => {
    const queueName = 'bacon.bc';
    const routingKey = 'bacon.bc';
    const sequence = processConfig.Path11;

    try {
        const productionOrders = await consumeRabbitMQ({
            queueName,
            routingKey,
            sequence,
            batchSize: 5, // Customize batch size
            timeout: 5000, // Customize timeout
        });

        console.log('Processed Production Orders:', productionOrders);
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
})();
