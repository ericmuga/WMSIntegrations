export function generateOrders(numOrders = 3, maxItemsPerOrder = 5) {
    let orderCounter = 1000; // Starting order number
    let salesLineCounter = 1; // Starting sales line number
  
    const orders = [];
  
    for (let i = 0; i < numOrders; i++) {
      // Generate a new order
      const order_no = `ORD${orderCounter++}`;
      const orderItems = [];
      salesLineCounter = 1; // Reset sales line number for each new order
  
      const numItems = Math.floor(Math.random() * maxItemsPerOrder) + 1; // Random number of items for each order
  
      for (let j = 0; j < numItems; j++) {
        // Generate an order line (sales line)
        const item = {
          sales_line_no: salesLineCounter++, // Sequential sales line number
          item_code: `ITEM${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
          quantity: Math.floor(Math.random() * 100) + 1,
          unit_of_measure: ["PCS", "BOX", "KG"][Math.floor(Math.random() * 3)], // Random unit of measure
          product_specifications: Math.random() > 0.5 ? "Specification A" : "", // Random specification
        };
        orderItems.push(item);
      }
  
      // Construct the order with details and items
      const order = {
        order_no,
        customer_code: `CUST${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        shipment_date: new Date().toISOString().slice(0, 10), // Format as YYYY-MM-DD
        sales_code: `SALE${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        ship_to_code: `SHIP${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        ship_to_name: "Customer Shipping Location",
        status: ["Shipped", "Pending", "Delivered"][Math.floor(Math.random() * 3)], // Random status
        customer_specification: Math.random() > 0.5 ? "Custom Spec A" : "", // Random customer specification
        PDA: Math.random() > 0.5, // Randomly set PDA flag to true or false
        order_items: orderItems,
      };
  
      orders.push(order);
    }
  
    return orders;
  }
  
  // Example usage
  // const generatedOrders = generateOrders(3, 5); // Generate 3 orders with up to 5 items each
  // console.log(JSON.stringify(generatedOrders, null, 2));
  