import { getRabbitMQConnection } from '../../config/default.js';

export async function fetchProductionOrdersFromQueue(batchSize = 100) {
    const connection = await getRabbitMQConnection();
    const channel = await connection.createChannel();

    await channel.assertQueue('production_orders', { durable: true });

    const orders = [];

    for (let i = 0; i < batchSize; i++) {
        const msg = await channel.get('production_orders', { noAck: false });
        if (!msg) break;

        const content = JSON.parse(msg.content.toString());
        orders.push(content);
        channel.ack(msg);
    }

    await channel.close();
    return orders;
}
