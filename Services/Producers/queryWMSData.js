import sql from "mssql";
import amqp from "amqplib";
// import dotenv from "dotenv";
import { getPool } from "../../config/default.js";

// dotenv.config();

import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';


const pool = await getPool('wms');

// const start_date = '2025-01-04'; 
// Function to fetch data from idt_transfers table
const start_date = '2025-01-04';

// Function to fetch data from idt_transfers table
async function fetchTransferData() {
    try {
        const result = await pool.request()
            .input('startDate', sql.Date, start_date) // Pass the date as a parameter
            .query(`
                SELECT id
                    ,product_code
                    ,location_code AS transfer_to
                    ,transfer_from
                    ,receiver_total_pieces
                    ,receiver_total_weight
                    ,received_by
                    ,created_at
                FROM idt_transfers
                WHERE created_at >= @startDate
                AND received_by IS NOT NULL
                AND NOT EXISTS (
                    SELECT 1 
                    FROM [100.100.2.39].[BOM].[dbo].[queue_status]
                    WHERE [record_id] = idt_transfers.id 
                    AND [table_name] = 'idt_transfers'
                )
            `);
        return result.recordset;
    } catch (error) {
        console.error('Error fetching transfer data:', error.message);
        throw error;
    }
}

// RabbitMQ Connection Details
const RABBITMQ_URL = process.env.RABBITMQ_URL;
const EXCHANGE_NAME = "fcl.exchange.direct";
const QUEUE_NAME = "production_data_order_chopping.bc";



// Resolve the Excel file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.resolve(__dirname, './ChoppingV1.xlsx'); // Update with your Excel file name

async function fetchDataFromExcel() {
    try {
        // Read the Excel file
        const workbook = xlsx.readFile(filePath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(worksheet);

        // Map data to match the expected schema
        const data = rows.map((row, index) => ({
            id: index + 1, // Generate a unique ID (optional if not in Excel)
            chopping_id: row['Run Id'],
            item_code: row['item Code'],
            weight: parseFloat(row['Weight']),
            batch_no: row['Batch No'] || null,
            created_at: row['Timestamp'],
            updated_at: row['Timestamp'],
        }));

        console.log('Fetched data from Excel:', data);
        return data;
    } catch (err) {
        console.error('Error reading Excel file:', err.message);
        throw err;
    }
}


// Fetch data from the database
async function fetchData() {
    try {
        const result = await pool.request()
            // .input('dateFilter', sql.DateTime, new Date(new Date().setDate(new Date().getDate() - 14)).toISOString())
             .input('startDate', sql.Date, start_date) 
            .query(`
                SELECT *
                FROM chopping_lines
                WHERE created_at >= @startDate
                AND NOT EXISTS (
                    SELECT 1
                    FROM [100.100.2.39].[BOM].[dbo].[queue_status]
                    WHERE record_id = chopping_lines.id
                    -- and item_code not in ('G2042','G2159')
                    AND table_name = '[FCL-WMS].[calibra].[dbo].chopping_lines'
                    
                )
                ORDER BY chopping_id, created_at, id
            `);

        console.log("FetchData Result:", result.recordset); // Log the result to verify structure
        return result.recordset;
    } catch (err) {
        console.error("Database query error:", err.message);
        throw err;
    }
}



// Group data by chopping_id
// function groupDataByChoppingId(data) {
//     return data.reduce((acc, row) => {
//         if (!acc[row.chopping_id]) {
//             acc[row.chopping_id] = [];
//         }
//         row.timestamp = new Date().toISOString(); // Add timestamp
//         acc[row.chopping_id].push(row);
//         return acc;
//     }, {});

// }

function groupAndFlattenDataWithGroupId(data) {
    return data.map(row => {
        const date = new Date(row.timestamp || Date.now()).toISOString().split('T')[0]; // Extract date
        const groupId = `${row.chopping_id}_${date}`; // Create group_id

        row.timestamp = new Date().toISOString(); // Ensure timestamp exists
        return { ...row, chopping_id: groupId }; // Replace chopping_id with group_id
    });
}

function transformToJson(data, companyName) {
    const jsonData = {};

    data.forEach((row, index) => {
        // Ensure timestamp exists or create one
        const timestamp = new Date().toISOString();
        jsonData[index] = {
            id: row.id,
            chopping_id: row.chopping_id,
            item_code: row.item_code,
            weight: row.weight.toString(),
            output: row.output.toString(),
            batch_no: row.batch_no,
            created_at: row.created_at,
            updated_at: row.updated_at,
            timestamp: timestamp
        };
    });

    // Add company_name as a key
    jsonData.company_name = companyName;

    return jsonData;
}


function validateAndEnsureOutput(groupedData) {
    const validatedData = {};

    for (const [choppingId, rows] of Object.entries(groupedData)) {
        const hasOutput = rows.some(row => row.output === 1);

        if (!hasOutput) {
            console.warn(`No output entry found for chopping_id: ${choppingId}. Skipping.`);
            continue; // Skip this group if no output is found
        }

        validatedData[choppingId] = rows;
    }

    return validatedData;
}




async function publishToQueue(data) {
    let connection, channel;
    try {
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();

        // Assert the exchange
        await channel.assertExchange(EXCHANGE_NAME, "direct", {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': 'fcl.exchange.dlx',
                'x-dead-letter-routing-key': QUEUE_NAME,
            },
        });

        // Group data by chopping_id and date
        const groupedData = {};
        data.forEach((row) => {
            const choppingId = row.chopping_id;
            const date = new Date(row.created_at).toISOString().split('T')[0]; // Extract date part

            const groupKey = `${choppingId}_${date}`;
            if (!groupedData[groupKey]) {
                groupedData[groupKey] = [];
            }
            groupedData[groupKey].push(row);
        });

        // Publish grouped data
        for (const [groupKey, lines] of Object.entries(groupedData)) {
            const date = new Date(row.created_at).toISOString().split('T')[0];
            const transformedData = lines.reduce((acc, line, index) => {
                acc[index] = {
                    id: line.id,
                    chopping_id: line.chopping_id,
                    item_code: line.item_code,
                    weight: line.weight.toString(),
                    output: line.output.toString(),
                    batch_no: line.batch_no,
                    created_at: line.created_at,
                    updated_at: line.updated_at,
                    timestamp: date,
                };
                return acc;
            }, {});

            // Add company_name to the payload
            transformedData.company_name = "FCL";

            const routingKey = QUEUE_NAME;

            // Publish the message
            await channel.publish(
                EXCHANGE_NAME,
                routingKey,
                Buffer.from(JSON.stringify(transformedData)),
                { persistent: true }
            );

            // Track published data
            await insertDataAfterPublishing(QUEUE_NAME, lines, "chopping_lines");

            console.log(`Published data for group: ${groupKey}`);
        }
    } catch (err) {
        console.error("RabbitMQ publish error:", err.message);
    } finally {
        if (channel) await channel.close();
        if (connection) await connection.close();
    }
}




// Function to fetch data from sales table
// async function fetchSalesData() {
    // const request = new sql.Request();
const fetchSalesData = async () => {
    try {
        // Use the pool and request pattern
        const pool = await getPool("wms");

        // const start_date = '2025-01-04'; // Define your start date
        const result = await pool.request()
            .input('startDate', sql.Date, start_date) // Pass start_date as a parameter
            .query(`
                SELECT 
                    id,
                    item_code,
                    no_of_carcass,
                    net_weight,
                    'beheading' AS process,
                    CASE 
                        WHEN returned = 0 THEN 'No'
                        WHEN returned = 1 THEN 'Yes'
                        WHEN returned = 2 THEN 'Return Entry'
                        ELSE 'Unknown'
                    END AS returned_status,
                    user_id,
                    created_at
                FROM sales
                WHERE created_at >= @startDate
                  AND NOT EXISTS (
                      SELECT 1
                      FROM [100.100.2.39].[BOM].[dbo].[queue_status]
                      WHERE record_id = sales.id 
                      AND table_name = '[FCL-WMS].[calibra].[dbo].sales'
                  )
            `);

        // Return the recordset
        return result.recordset;

    } catch (err) {
        console.error("Database query error:", err.message);
        throw err;
    }
};


// }

// Function to fetch data from beheading table
async function fetchBeheadingData() {
    // const start_date = '2025-01-04'; // Define your start date

    try {
        const result = await pool.request()
            .input('startDate', sql.Date, start_date) // Pass start_date as a parameter
            .query(`
                SELECT 
                    a.id,
                    a.item_code,
                    a.no_of_carcass,
                    a.net_weight,
                    b.process,
                    b.process_code,
                    a.user_id,
                    a.created_at
                FROM beheading_data AS a
                INNER JOIN processes AS b ON a.process_code = b.process_code
                WHERE a.created_at >= @startDate
                AND NOT EXISTS (
                    SELECT 1 
                    FROM [100.100.2.39].[BOM].[dbo].[queue_status] 
                    WHERE [record_id] = a.id 
                    AND [table_name] = '[FCL-WMS].[calibra].[dbo].beheading_data'
                )

                UNION

                SELECT 
                    a.id,
                    a.item_code,
                    a.no_of_pieces,
                    a.net_weight,
                    b.process,
                    a.process_code,
                    a.user_id,
                    a.created_at
                FROM deboned_data AS a
                INNER JOIN processes AS b ON a.process_code = b.process_code
                WHERE a.created_at >= @startDate
                AND a.process_code IN (0, 1)
                AND NOT EXISTS (
                    SELECT 1 
                    FROM [100.100.2.39].[BOM].[dbo].[queue_status] 
                    WHERE [record_id] = a.id 
                    AND [table_name] = '[FCL-WMS].[calibra].[dbo].deboned_data'
                )
            `);

        return result.recordset;

    } catch (err) {
        console.error("Database query error:", err.message);
        throw err;
    }
}


// Function to fetch data from breaking table
async function fetchBreakingData() {
    // const start_date = '2025-01-04'; // Define your start date

    try {
        const result = await pool.request()
            .input('startDate', sql.Date, start_date) // Pass start_date as a parameter
            .query(`
                SELECT 
                    a.id,
                    a.item_code,
                    a.net_weight,
                    b.process,
                    a.process_code,
                    a.product_type,
                    a.no_of_items,
                    a.user_id,
                    a.created_at
                FROM butchery_data AS a
                
                INNER JOIN processes AS b ON a.process_code = b.process_code
                WHERE a.created_at >= @startDate
                AND NOT EXISTS (
                    SELECT 1
                    FROM [100.100.2.39].[BOM].[dbo].[queue_status] 
                    WHERE [record_id] = a.id 
                    AND [table_name] = '[FCL-WMS].[calibra].[dbo].butchery_data'
                )
            `);

        return result.recordset;

    } catch (err) {
        console.error("Database query error:", err.message);
        throw err;
    }
}


// Function to fetch data from deboning table
async function fetchDeboningData() {
    // const start_date = '2025-01-04'; // Define your start date

    try {
        const result = await pool.request()
            .input('startDate', sql.Date, start_date) // Pass start_date as a parameter
            .query(`
                SELECT 
                    a.id,
                    a.item_code,
                    a.net_weight,
                    b.process,
                    a.process_code,
                    a.product_type,
                    a.no_of_pieces,
                    a.user_id,
                    a.created_at
                FROM deboned_data AS a
                INNER JOIN processes AS b ON a.process_code = b.process_code 
                WHERE a.created_at >= @startDate 
                  AND a.process_code NOT IN (0, 1) 
                  AND a.product_type <>3
                  AND NOT EXISTS (
                      SELECT 1 
                      FROM [100.100.2.39].[BOM].[dbo].[queue_status] 
                      WHERE record_id = a.id 
                      AND table_name = '[FCL-WMS].[calibra].[dbo].deboned_data'
                  )
            `);

        return result.recordset;

    } catch (err) {
        console.error("Database query error:", err.message);
        throw err;
    }
}




function mapSalesData(data) {
    if (!Array.isArray(data)) {
        console.error("Expected an array but received:", typeof data, data);
        throw new Error("Input to mapSalesData must be an array");
    }

    return data.map(row => ({
        product_code: row.item_code,
        transfer_from_location: '1570',
        transfer_to_location: '3535',
        total_pieces: row.no_of_carcass || 0,
        receiver_total_weight: row.net_weight,
        created_by: row.user_id, // Assuming Auth is defined and has id method
        production_date: row.created_at, // Today's date
        timestamp: row.created_at,
        id: row.id,
    }));
}

// Function to map beheading data
function mapBeheadingData(data) {
    return data.map(row => ({
        item_code: row.item_code,
        process_name: row.process,
        process_code: row.process_code,
        total_pieces: row.no_of_carcass || 0,
        total_weight: row.net_weight,
        created_by: row.user_id, // Assuming Auth is defined and has id method
        production_date: row.created_at, // Today's date
        timestamp: row.created_at,
        id: row.id,
    }));
}

// Function to map beheading data
function mapBreakingData(data) {
    return data.map(row => ({
        item_code: row.item_code,
        process_code: row.process_code,
        process_name: row.process,
        total_pieces: row.no_of_items || 0,
        net_weight: row.net_weight,
        created_by: row.user_id, // Assuming Auth is defined and has id method
        production_date: row.created_at, // Today's date
        timestamp: row.created_at,
        id: row.id,
    }));
}

// Function to map deboning data
function mapDeboningData(data) {
    return data.map(row => ({
        item_code: row.item_code,
        product_type: row.product_type,
        process_name: row.process,
        process_code: row.process_code,
        total_pieces: row.no_of_items || 0,
        net_weight: row.net_weight,
        created_by: row.user_id, // Assuming Auth is defined and has id method
        production_date: row.created_at, // Today's date
        timestamp: row.created_at,
        id: row.id,
    }));
}

// Publish transfer data to RabbitMQ
async function publishTransferDataToQueue(data) {
    let connection, channel;
    try {
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();

        await channel.assertExchange(EXCHANGE_NAME, "direct", { 
            durable: true,
        });

        const routingKey = 'production_data_transfer.bc';

        for (const message of data) {
            await channel.publish(
                EXCHANGE_NAME,
                routingKey,
                Buffer.from(JSON.stringify(message)),
                { persistent: true },
            );

            console.log(`Published transfer data for id: ${message.id}`);
        }
    } catch (err) {
        console.error("RabbitMQ publish error:", err.message);
    } finally {
        if (channel) await channel.close();
        if (connection) await connection.close();
    }
}

// Publish sales data to RabbitMQ
async function publishSalesDataToQueue(data) {
    let connection, channel;
    try {
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();

        await channel.assertExchange(EXCHANGE_NAME, "direct", { 
            durable: true,
        });

        const routingKey = 'production_sales_transfers.bc';

        for (const message of data) {
            await channel.publish(
                EXCHANGE_NAME,
                routingKey,
                Buffer.from(JSON.stringify(message)),
                { persistent: true },
            );

            console.log(`Published sales data for id: ${message.id}`);
            
        }
        
        try {
            const result =await insertDataAfterPublishing(routingKey,data,'sales');
            console.log(result);
        } catch (error) {
            console.error('Error inserting data:', error.message);
        }


    } catch (err) {
        console.error("RabbitMQ publish error:", err.message);
    } finally {
        if (channel) await channel.close();
        if (connection) await connection.close();
    }
}

// Publish beheading data to RabbitMQ
async function publishBeheadingDataToQueue(data) {
    let connection, channel;
    try {
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();

        await channel.assertExchange(EXCHANGE_NAME, "direct", {
            durable: true,
        });

        const routingKey = 'production_data_order_beheading.bc';

        for (const message of data) {
            await channel.publish(
                EXCHANGE_NAME,
                routingKey,
                Buffer.from(JSON.stringify(message)),
                { persistent: true },
            );

            
            
           // Determine the table_name based on the data
            const table_name = message.process_code > 1 ? 'beheading_data' : 'deboned_data';

            // Insert data for this specific message
            await insertDataAfterPublishing(routingKey, [message], table_name);

            console.log(`Published beheading data for id: ${message.id}`);
        }
        // let table_name=data.process_code>1?'beheading_data':'deboned_data';
        //  await insertDataAfterPublishing(routingKey,data, 'beheading_data');
    } catch (err) {
        console.error("RabbitMQ publish error:", err.message);
    } finally {
        if (channel) await channel.close();
        if (connection) await connection.close();
    }
}

// Publish breaking data to RabbitMQ
async function publishBreakingDataToQueue(data) {
    let connection, channel;
    try {
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();

        await channel.assertExchange(EXCHANGE_NAME, "direct", {
            durable: true,
        });

        const routingKey = 'production_data_order_breaking.bc';

        for (const message of data) {
            await channel.publish(
                EXCHANGE_NAME,
                routingKey,
                Buffer.from(JSON.stringify(message)),
                { persistent: true },
            );

            
            console.log(`Published breaking data for id: ${message.id}`);
        }
        await insertDataAfterPublishing(routingKey,data,'butchery_data');

    } catch (err) {
        console.error("RabbitMQ publish error:", err.message);
    } finally {
        if (channel) await channel.close();
        if (connection) await connection.close();
    }
}

// Publish deboning data to RabbitMQ
async function publishDeboningDataToQueue(data) {
    let connection, channel;
    try {
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();

        await channel.assertExchange(EXCHANGE_NAME, "direct", {
            durable: true,
        });

        const routingKey = 'production_data_order_deboning.bc';

        for (const message of data) {
            await channel.publish(
                EXCHANGE_NAME,
                routingKey,
                Buffer.from(JSON.stringify(message)),
                { persistent: true },
            );
           

            console.log(`Published deboning data for id: ${message.id}`);
        } 
        await insertDataAfterPublishing(routingKey,data,'deboned_data');
    } catch (err) {
        console.error("RabbitMQ publish error:", err.message);
    } finally {
        if (channel) await channel.close();
        if (connection) await connection.close();
    }
}



export const publishChoppingData = async () => {
    try {
        const data = await fetchData();
        if (!data || data.length === 0) {
            console.warn("No data fetched from the database.");
            return; // Stop further processing
        }
        // const groupedData = groupAndFlattenDataWithGroupId(data);
        await publishToQueue(data);
    } catch (err) {
        console.error("Error in publishChoppingData:", err.message);
    }
};





export const publishCarcassSalesData = async () => {
        const salesData = await fetchSalesData() || [];
        const mappedSalesData = mapSalesData(salesData);
        await publishSalesDataToQueue(mappedSalesData);
        console.log("Sales data published to RabbitMQ successfully!"); 
}


export const publishBeheadingData   = async () => {
        const beheadingData = await fetchBeheadingData();
        const mappedBeheadingData = mapBeheadingData(beheadingData);
        await publishBeheadingDataToQueue(mappedBeheadingData);
        console.log("Beheading data published to RabbitMQ successfully!");
}


export const publishBreakingData = async () => {
    // fetch and write breaking data
        const breakingData = await fetchBreakingData();
        const mappedBreakingData = mapBreakingData(breakingData);
        await publishBreakingDataToQueue(mappedBreakingData);
        console.log("Breaking data published to RabbitMQ successfully!");

}

export const publishDeboningData = async () => {
        const deboningData = await fetchDeboningData();
        const mappedDeboningData = mapDeboningData(deboningData);
        await publishDeboningDataToQueue(mappedDeboningData);
        console.log("Deboning data published to RabbitMQ successfully!");

}



//insertdataAfterPublishing
// prefix [FCL-WMS].[calibra].[dbo]
// queue_name

export const insertDataAfterPublishing = async (queue_name, data, table_name) => {
    if (data.length > 0) {
        const ids = data.map(row => row.id);
        const tablePrefix = '[FCL-WMS].[calibra].[dbo]';
        const queueTable = '[100.100.2.39].[BOM].[dbo].[queue_status]';
        const batchSize = 1000; // Maximum allowed number of rows per batch

        for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize);
            const values = batch
                .map(id => `(${id}, '${tablePrefix}.${table_name}', '${queue_name}', 'published')`)
                .join(', ');

            const query = `
                INSERT INTO ${queueTable} (record_id, table_name, queue_name, status)
                SELECT record_id, table_name, queue_name, status
                FROM (VALUES ${values}) AS temp (record_id, table_name, queue_name, status)
                WHERE NOT EXISTS (
                    SELECT 1 
                    FROM ${queueTable} 
                    WHERE ${queueTable}.record_id = temp.record_id
                      AND ${queueTable}.table_name = temp.table_name
                      AND ${queueTable}.queue_name = temp.queue_name
                      AND ${queueTable}.status = temp.status
                );
            `;

            console.log(`Executing batch ${Math.floor(i / batchSize) + 1}...`);
            console.log(query);

            try {
                await pool.request().query(query);
                console.log(`Batch ${Math.floor(i / batchSize) + 1} inserted successfully`);
            } catch (err) {
                console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, err.message);
                throw err;
            }
        }
    }
};



