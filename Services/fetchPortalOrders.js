// Import data from repo.js
import { customers, items, salesPersons } from "../repo.js";

let orderCounter = 1000;

// Function to generate a unique order number
export function generateUniqueOrderNo() {
  const paddedCounter = String(orderCounter).padStart(4, '0');
  orderCounter++;
  return `ORD${paddedCounter}`;
}

// Function to get a random element from an array
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Function to generate orders using master data
export function generateOrders(numOrders = 3, maxItemsPerOrder = 5) {
  const orders = [];

  for (let i = 0; i < numOrders; i++) {
    const order_no = generateUniqueOrderNo();
    const customer = getRandomElement(customers); // Randomly select a customer
    const shipTo = getRandomElement(customer.ship_to_array); // Randomly select a ship-to address
    const salesperson = getRandomElement(salesPersons); // Randomly select a salesperson

    // Debugging log to ensure salesperson selection is working
    console.log("Selected Salesperson:", salesperson);

    const orderItems = [];
    let salesLineCounter = 1; // Reset sales line number for each new order

    const numItems = Math.floor(Math.random() * maxItemsPerOrder) + 1;

    for (let j = 0; j < numItems; j++) {
      const item = getRandomElement(items); // Randomly select an item
      const quantity = Math.floor(Math.random() * 100) + 1;

      const orderItem = {
        sales_line_no: salesLineCounter++,
        item_code: item.item_code,
        quantity,
        unit_of_measure: item.unit_of_measure,
        product_specifications: Math.random() > 0.5 ? "Specification A" : "", // Random specification
      };
      orderItems.push(orderItem);
    }

    // Construct the order with details and items
    const order = {
      order_no,
      customer_code: customer.cust_no,
      customer_name: customer.customer_name,
      shipment_date: new Date().toISOString().slice(0, 10), // Format as YYYY-MM-DD
      sales_person_code: salesperson.sp_code,
      sales_person_name: salesperson.name,
      ship_to_code: shipTo.shp_no,
      ship_to_name: shipTo.ship_to_name,
      status: ["Shipped", "Pending", "Delivered"][Math.floor(Math.random() * 3)],
      customer_specification: Math.random() > 0.5 ? "Custom Spec A" : "",
      PDA: Math.random() > 0.5, // Randomly set PDA flag
      order_items: orderItems,
    };

    // Debugging log to ensure order contains the necessary fields
    console.log("Generated Order:", order);

    orders.push(order);
  }

  return orders;
}




// Example usage
// const generatedOrders = generateOrders(3, 5);
// console.log(JSON.stringify(generatedOrders, null, 2));
