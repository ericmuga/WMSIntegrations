import amqp from 'amqplib';

export const getSerialNumber = async (queueName) => {
    try {
        const connection = await amqp.connect('amqp://localhost');
        const channel = await connection.createChannel();

        await channel.assertQueue(queueName, { durable: true });

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
            await channel.close();
            await connection.close();

            return serialNumber;
        } else {
            console.error('Queue is empty. Cannot generate serial number.');
            await channel.close();
            await connection.close();
            return null;
        }
    } catch (error) {
        console.error('Error generating serial number:', error.message);
    }
};
