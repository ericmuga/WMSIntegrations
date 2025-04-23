import { getPool } from '../../config/default.js';
import { getRabbitMQConnection } from '../../config/default.js';
import { roundTo4Decimals } from '../utils/utilities.js';
import logger from '../../logger.js';

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
    const queueName = 'production_orders.bc';
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

export async function fetchAndPublishSlaughterData() {
    const pool = await getPool('wms');

    const result = await pool.request().query(`
        SELECT * FROM [calibra].[dbo].[slaughter_data] 
        WHERE Published = 0 
        AND [created_at] >= DATEADD(d, -2, DATEDIFF(d, 0, GETDATE()))
    `);

    const rows = result.recordset;

    if (!rows || rows.length === 0) {
        logger.info('No new slaughter data found to publish.');
        return 0;
    }

    const connection = await getRabbitMQConnection();
    const channel = await connection.createChannel();
    const queueName = 'slaughter_line.bc'; // Replace this with your actual routing key
    await channel.assertExchange('fcl.exchange.direct', 'direct', { durable: true });

    for (const row of rows) {
        const payload = JSON.stringify([{
            id: row.id,
            slapmark: row.slapmark,
            receipt_no: row.receipt_no,
            item_code: row.carcass_type,
            vendor_no: row.vendor_no,
            vendor_name: row.vendor_name,
            actual_weight: row.reading,
            net_weight: row.net,
            settlement_weight: row.settlement_weight,
            meat_percent: row.meat_percent,
            classification_code: row.classification_code,
            manual_weight: row.manual_weight,
            user_id: row.user_id,
            company_name:'FCL',
            timestamp: row.created_at,
        }]);

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

    logger.info(`Published ${rows.length} slaughter data to RabbitMQ`);
    await channel.close();

    const slaughterDataIds = rows.map(row => row.id).join(',');
    await pool.request().query(`
        UPDATE [calibra].[dbo].[slaughter_data] 
        SET Published = 1 
        WHERE id IN (${slaughterDataIds})
    `);

    return rows.length;
}

// Run once on launch
(async () => {
    try {
        const productionCount = await fetchAndPublishProductionOrders();
        console.log(`Published ${productionCount} production orders to RabbitMQ`);

        const slaughterCount = await fetchAndPublishSlaughterData();
        console.log(`Published ${slaughterCount} slaughter data to RabbitMQ`);
    } catch (error) {
        console.error(`Error publishing data: ${error.message}`);
    }
})();

// Schedule every 2 minutes
setInterval(async () => {
    try {
        // const productionCount = await fetchAndPublishProductionOrders();
        // console.log(`Published ${productionCount} production orders to RabbitMQ`);

        const slaughterCount = await fetchAndPublishSlaughterData();
        console.log(`Published ${slaughterCount} slaughter data to RabbitMQ`);
    } catch (error) {
        console.error(`Error publishing data: ${error.message}`);
    }
}, 120000); // 2 minutes in ms

