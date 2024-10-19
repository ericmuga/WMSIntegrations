// testRabbitMQ.js
import connectRabbitMQ from './RabbitMQService.js';  // Import the RabbitMQ connection function
import logger from './logger.js';  // Import your logger

async function testConnection() {
    try {
        const connection = await connectRabbitMQ();  // Call the connection function
        logger.info('RabbitMQ connection test successful.');

        // Close the connection to avoid leaving it open
        await connection.close();
        logger.info('RabbitMQ connection closed.');
    } catch (error) {
        logger.error('Failed to connect to RabbitMQ: ' + error.message);
    }
}

// Run the test
testConnection();
