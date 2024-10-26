// transferOrderGenerator.js

let orderCounter = 1000; // Starting transfer order number

// Function to generate a single transfer order
const generateTransferOrder = (maxItemsPerOrder = 5) => {
  const transfer_order_no = `TO${orderCounter++}`;
  const transfer_from_code = `LOC${Math.floor(Math.random() * 100).toString().padStart(3, '0')}`;
  const transfer_to_code = `LOC${Math.floor(Math.random() * 100).toString().padStart(3, '0')}`;
  const issuer = "John Doe";
  const receiver = "Jane Smith";
  const shipment_date = new Date().toISOString().slice(0, 10);
  const status = ["In Transit", "Pending", "Completed"][Math.floor(Math.random() * 3)];

  // Generate order items
  const transferItems = Array.from({ length: Math.floor(Math.random() * maxItemsPerOrder) + 1 }, (_, index) => ({
    transfer_line_no: index + 1,
    item_code: `ITEM${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    quantity: Math.floor(Math.random() * 100) + 1,
    unit_of_measure: ["PCS", "BOX", "KG"][Math.floor(Math.random() * 3)],
    product_specifications: Math.random() > 0.5 ? "Special handling required" : "",
    batch_info: [
      {
        batch_no: `BATCH${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        quantity: Math.floor(Math.random() * 50) + 1
      },
      {
        batch_no: `BATCH${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        quantity: Math.floor(Math.random() * 50) + 1
      }
    ]
  }));

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
