import { Mutex } from 'async-mutex';
import { getRabbitMQConnection } from '../config/default.js';

let connection = null;
let channel = null;

const mutex = new Mutex();

const getChannel = async () => {
    if (!connection) {
        connection = await getRabbitMQConnection();
    }
    if (!channel) {
        channel = await connection.createChannel();
    }
    return channel;
};

export const getSerialNumber = async (queueName) => {
    try {
        return await mutex.runExclusive(async () => {
            const channel = await getChannel();

            // Ensure the queue exists
            await channel.assertQueue(queueName, { durable: true });

            // Check if the queue is empty and initialize if needed
            const queueStatus = await channel.checkQueue(queueName);
            if (queueStatus.messageCount === 0) {
                console.log('Queue is empty. Initializing counter.');
                await channel.sendToQueue(queueName, Buffer.from('1'), { persistent: true });
            }

            // Get the current counter from the queue
            const message = await channel.get(queueName, { noAck: false });

            if (message) {
                const currentCounter = parseInt(message.content.toString(), 10);

                // Generate the serial number
                const serialNumber = `DOC-${String(currentCounter).padStart(8, '0')}`; // e.g., DOC-00000001

                // Increment and re-publish the counter
                const nextCounter = currentCounter + 1;
                await channel.sendToQueue(queueName, Buffer.from(String(nextCounter)), {
                    persistent: true,
                });

                channel.ack(message);

                console.log(`Generated Serial Number: ${serialNumber}`);

                return serialNumber;
            } else {
                console.error('Queue is empty even after initialization. Cannot generate serial number.');
                return null;
            }
        });
    } catch (error) {
        console.error('Error generating serial number:', error.message);
        throw error; // Re-throw error for better error handling in calling code
    }
};