import { processQueueWorkflow } from '../Utils/processQueueWorkflow.js';
// import { queries } from '../Utils/dbUtils.js';

const sourceTable = '[FCL-WMS].[calibra].[dbo].[idt_transfers]'; // Source table
const queueTable = '[BOM].[dbo].[queue_status]'; // Queue status table
const queueName = 'sausages.bc'; // RabbitMQ queue name

// Custom query parameters for filtering
const customParams = {
  location_code: ['3600', '3535'], // Additional condition as an array
  transfer_from: '2055', // Additional condition as a single value
};

// Default query parameters
const defaultParams = {
  start_date: '2024-12-16',
  startDate: '2024-12-16',
};

// Transformation function to format records for RabbitMQ
const transformFn = (row) => ({
  product_code: row.product_code,
  transfer_from_location: row.transfer_from_location,
  transfer_to_location: row.transfer_to_location,
  receiver_total_pieces: row.receiver_total_pieces,
  receiver_total_weight: row.receiver_total_weight,
  received_by: row.received_by,
  production_date: row.production_date,
  with_variance: row.with_variance,
  timestamp: row.created_at,
  id: row.id,
  company_name: 'FCL',
});

// Execute the workflow
processQueueWorkflow(
  sourceTable, // Source table name
  queueTable, // Queue status table
  queueName, // RabbitMQ queue name
  { ...defaultParams, ...customParams }, // Merged query parameters
  transformFn // Transformation function
)
  .then(() => {
    console.log('Queue processing workflow completed.');
  })
  .catch((error) => {
    console.error(`Queue processing workflow failed: ${error.message}`);
  });
