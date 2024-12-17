import { processProductionOrders } from "./queueProcessor.js";
import { processConfig } from './processConfig.js';

// Call the function
(async () => {
    await processProductionOrders({
        queueName: 'transfer_from_2055_to_3535',
        routingKey: queueName,
        sequence: processConfig.sausage, // Example sequence
        batchSize: 1, // Customize batch size
        timeout: 5000, // Customize timeout
    });
})();