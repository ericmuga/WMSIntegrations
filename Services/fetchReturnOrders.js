export function generateReturnOrders(
  numOrders = 3,
  maxItemsPerOrder = 5,
  filters = {}
) {
  const {
    customer,
    shipment_date,
    salesperson,
    load_to_code,
    status = "Pending", // Default status
    rf_no_prefix = "RF", // Default RF prefix
  } = filters;

  const orders = [];

  for (let i = 0; i < numOrders; i++) {
    const order_no = `ORD${Math.floor(1000 + Math.random() * 9000)}`; // Generate unique order numbers
    const rf_no = `${rf_no_prefix}${Math.floor(1000 + Math.random() * 9000)}`; // Generate unique RF numbers

    const customerData =
      customers.find((c) => c.cust_no === customer) || getRandomElement(customers);
    const shipTo =
      customerData.ship_to_array.find((s) => s.shp_no === load_to_code) ||
      getRandomElement(customerData.ship_to_array);
    const salesPersonData =
      salesPersons.find((sp) => sp.sp_code === salesperson) ||
      getRandomElement(salesPersons);

    const orderItems = [];
    let salesLineCounter = 1; // Reset sales line number for each new order

    const numItems = Math.floor(Math.random() * maxItemsPerOrder) + 1;

    for (let j = 0; j < numItems; j++) {
      const item = getRandomElement(items); // Randomly select an item
      const quantityReturned = Math.floor(Math.random() * 50) + 1; // Random quantity returned
      const returnReason = getRandomElement([
        "BOD",
        "SHORT SUPPLY",
        "DAMAGED",
        "WRONG ITEM",
      ]);

      const orderItem = {
        sales_line_no: salesLineCounter++,
        item_code: item.item_code,
        quantity_returned: quantityReturned,
        unit_of_measure: item.unit_of_measure,
        return_reason: returnReason,
      };
      orderItems.push(orderItem);
    }

    // Construct the return order with details and items
    const returnOrder = {
      invoice_no: order_no,
      rf_no,
      customer_code: customerData.cust_no,
      customer_name: customerData.customer_name,
      shipment_date: shipment_date || new Date().toISOString().slice(0, 10), // Use provided shipment date or current date
      sales_person_code: salesPersonData.sp_code,
      sales_person_name: salesPersonData.name,
      ship_to_code: shipTo.shp_no,
      ship_to_name: shipTo.ship_to_name,
      status,
      shipment_image_url: `https://example.com/${order_no}_shipment.png`, // Mock shipment image URL
      order_items: orderItems,
    };

    orders.push(returnOrder);
  }

  return orders;
}

// Helper function to get a random element from an array
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Mock Data
const customers = [
  {
    cust_no: "913",
    customer_name: "Majid Al Futtaim Hypermarkets Ltd",
    ship_to_array: [
      { shp_no: "013", ship_to_name: "Carrefour - Two Rivers" },
      { shp_no: "014", ship_to_name: "Carrefour - Village Market" },
    ],
  },
  {
    cust_no: "914",
    customer_name: "Retail Corporation",
    ship_to_array: [
      { shp_no: "015", ship_to_name: "Retail City Mall" },
      { shp_no: "016", ship_to_name: "Retail Westgate Mall" },
    ],
  },
];

const salesPersons = [
  { sp_code: "013", name: "Retail City Center II" },
  { sp_code: "014", name: "Retail Village Market" },
];

const items = [
  { item_code: "J31031706", unit_of_measure: "PC" },
  { item_code: "J31031707", unit_of_measure: "KG" },
  { item_code: "J31031708", unit_of_measure: "LTR" },
];

// // Example Usage
// const mockResponse = fetchReturnOrders('https://mock-api.example.com', {
//   num_orders: 2,
//   shipment_date: "2024-11-23",
//   customer: "914",
//   company: "FCL",
//   salesperson: "014",
//   load_to_code: "016",
//   rf_no_prefix: "RF",
//   status: "Pending",
// });