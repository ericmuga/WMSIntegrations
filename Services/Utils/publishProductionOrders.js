import { getPool } from '../../config/default.js';
import { getRabbitMQConnection } from '../../config/default.js';
import { roundTo4Decimals } from '../utils/utilities.js';

const queueName = 'production_orders.bc';



export async function fetchAndPublishProductionOrders() {
    const pool = await getPool('wms'); // calibra
    const result = await pool.request().query(`
        SELECT * FROM [calibra].[dbo].[ProductionData] WHERE Published = 0
    `);

    const rows = result.recordset;
//save the production order no for later updating as published
    const productionOrderNos = rows.map(row => row.ProductionOrderNo);
    const productionOrderNosString = productionOrderNos.join(',');
   

    const groupedOrders = {};

   rows.forEach(row => {
    const orderNo = row.ProductionOrderNo;

    if (!groupedOrders[orderNo]) {
        groupedOrders[orderNo] = {
            production_order_no: orderNo,
            ItemNo: null,
            Quantity: null,
            uom: null,
            LocationCode: null,
            BIN: '',
            user: '',
            line_no: null,
            routing: '',
            date_time: row.DateTime,
            ProductionJournalLines: [],
        };
    }

    // If this is the output line, set header data
    if (row.LineNo === 1000) {
        groupedOrders[orderNo].ItemNo = row.ItemNo;
        groupedOrders[orderNo].Quantity = roundTo4Decimals(row.Quantity);
        groupedOrders[orderNo].uom = row.UOM;
        groupedOrders[orderNo].LocationCode = row.LocationCode || '';
        groupedOrders[orderNo].BIN = row.BinCode || '';
        groupedOrders[orderNo].user = row.UserName || '';
        groupedOrders[orderNo].line_no = row.LineNo;
        groupedOrders[orderNo].routing = row.Routing || '';
        groupedOrders[orderNo].date_time = row.DateTime;
    }

    // SAFELY construct and push the line object
    groupedOrders[orderNo].ProductionJournalLines.push({
        ItemNo: row.ItemNo,
        Quantity: roundTo4Decimals(row.Quantity),
        uom: row.UOM || '',
        LocationCode: row.LocationCode || '',
        BIN: row.BinCode || '',
        line_no: row.LineNo,
        type: row.LineNo === 1000 ? 'output' : 'consumption',
        date_time: row.DateTime,
        user: row.UserName || '',
    });
});

    const connection = await getRabbitMQConnection();
    const channel = await connection.createChannel();
    await channel.assertExchange('fcl.exchange.direct', 'direct', { durable: true });

    const orders = Object.values(groupedOrders);

    // console.log(JSON.stringify(orders, null, 2));

    // Publish each order to the RabbitMQ queue
    for (const order of orders) {
        console.log(JSON.stringify(order, null, 2));
        const payload = JSON.stringify(order);

        
    
        await channel.publish(
            'fcl.exchange.direct',
            queueName,
            Buffer.from(payload),
            {
                persistent: true,
                contentType: 'application/json',
            }
        );
        console.log(',');
        // console.log(`Published order ${order.production_order_no} to queue`);
    
    
    }

     await pool.request().query(`
        UPDATE [calibra].[dbo].[ProductionData] SET Published = 1 WHERE ProductionOrderNo IN (${productionOrderNosString})  
    `);
    // console.log(`Updated ${rows.length} production orders as published`);
   await channel.close();
    return orders.length;
}

// const count = await fetchAndPublishProductionOrders();
//         console.log(`Published ${count} production orders to RabbitMQ`);

setInterval(async () => {
    try {
        const count = await fetchAndPublishProductionOrders();
        console.log(`Published ${count} production orders to RabbitMQ`);
    } catch (error) {
        console.error(`Error publishing production orders: ${error.message}`);
    }
}, 60000); // every 10 seconds

// setInterval(async () => {
