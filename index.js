// index.js
import express from 'express';
import logger from './logger.js';
// import connectRabbitMQ from './RabbitMQService.js';
import { getRabbitMQConnection } from './config/default.js';  // Import the config

const app = express();
app.use(express.json());

app.post('/sendMessage', async (req, res) => {
    const item = req.body;

    try {
        // Establish RabbitMQ connection using the config from config.js
        const connection = getRabbitMQConnection();
        const channel = await connection.createChannel();

        const queue = 'item_modify_queue';
        const message = JSON.stringify(item);

        // Ensure the queue is durable and ready
        await channel.assertQueue(queue, { durable: true });
        channel.sendToQueue(queue, Buffer.from(message));

        logger.info(` [x] Sent item: ${message}`);
        res.status(200).send(`success`);

        // Close the connection after a short delay
        // setTimeout(() => connection.close(), 500);

    } catch (error) {
        logger.error('Error connecting to RabbitMQ: ' + error.message);
        res.status(200).send(`success`);
        // res.status(500).send('Error connecting to RabbitMQ');
       // res.status(200).send('Error connecting to RabbitMQ');
    }
});

// Start the server
const port = 3000;
app.listen(port, () => {
    logger.info(`RabbitMQ API running at http://localhost:${port}`);
});
