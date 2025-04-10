import { getPool } from '../../config/default.js';
import { getRabbitMQConnection } from '../../config/default.js';
import { roundTo4Decimals } from '../utils/utilities.js';
import logger from '../../logger.js';

const queueName = 'production_orders.bc';

export async function fetchAndPublishProductionOrders() {
    const pool = await getPool('wms');

    const result = await pool.request().query(`
        SELECT * FROM [calibra].[dbo].[ProductionData] 
        WHERE Published = 0 
        AND [DateTime] >= DATEADD(d, -2, DATEDIFF(d, 0, GETDATE()))
    `);

    const rows = result.recordset;

    // ✅ Early exit if no records to publish
    if (!rows || rows.length === 0) {
        logger.info('No new production orders found to publish.');
        return 0;
    }

    const productionOrderNos = rows.map(row => row.ProductionOrderNo);
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

    for (const order of orders) {
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
    }

    logger.info(`Published ${rows.length} production orders to RabbitMQ`);
    await channel.close();

    if (productionOrderNos.length > 0) {
        const productionOrderNosString = productionOrderNos.map(no => `'${no}'`).join(',');
        await pool.request().query(`
            UPDATE [calibra].[dbo].[ProductionData] 
            SET Published = 1 
            WHERE ProductionOrderNo IN (${productionOrderNosString})
        `);
    }

    return orders.length;
}

// Run once on launch
(async () => {
    try {
        const count = await fetchAndPublishProductionOrders();
        console.log(`Published ${count} production orders to RabbitMQ`);
    } catch (error) {
        console.error(`Error publishing production orders: ${error.message}`);
    }
})();

// Schedule every 5 minutes
setInterval(async () => {
    try {
        const count = await fetchAndPublishProductionOrders();
        console.log(`Published ${count} production orders to RabbitMQ`);
    } catch (error) {
        console.error(`Error publishing production orders: ${error.message}`);
    }
}, 120000);
