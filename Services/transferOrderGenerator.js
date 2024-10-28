// transferOrderGenerator.js

// Import data from repo.js
import { items } from "../repo.js";

// Starting transfer order number
let orderCounter = 1000;

// Helper function to get a random element from an array
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Function to generate a single transfer order
const generateTransferOrder = (maxItemsPerOrder = 5) => {
  const transfer_order_no = `TO${orderCounter++}`;
  
  // Set origin and destination codes
  const transfer_from_code = "3535";
  const transfer_to_code = "3600";

  // Set issuer and receiver
  const issuer = "EMUGA";
  const receiver = "EKARANJA";
  const shipment_date = new Date().toISOString().slice(0, 10);
  const status = ["In Transit", "Pending", "Completed"][Math.floor(Math.random() * 3)];

  // Generate order items using items from repo
  const transferItems = Array.from({ length: Math.floor(Math.random() * maxItemsPerOrder) + 1 }, (_, index) => {
    const item = getRandomElement(items);
    const quantity = Math.floor(Math.random() * 100) + 1;

    // Generate batch quantities that sum up to the line quantity
    const batchQuantity1 = Math.floor(quantity / 2);
    const batchQuantity2 = quantity - batchQuantity1;

    return {
      transfer_line_no: index + 1,
      item_code: item.item_code,
      quantity,
      unit_of_measure: item.unit_of_measure,
      product_specifications: Math.random() > 0.5 ? "Special handling required" : "",
      batch_info: [
        {
          batch_no: `BATCH${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
          quantity: batchQuantity1
        },
        {
          batch_no: `BATCH${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
          quantity: batchQuantity2
        }
      ]
    };
  });

  return {
    transfer_order_no,
    transfer_from_code,
    transfer_to_code,
    issuer,
    receiver,
    shipment_date,
    status,
    order_items: transferItems
  };
};

// Function to generate multiple transfer orders
export const generateTransferOrders = (numOrders = 3, maxItemsPerOrder = 5) => 
  Array.from({ length: numOrders }, () => generateTransferOrder(maxItemsPerOrder));
