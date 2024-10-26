export function generateInvoices(numOrders = 3, maxItemsPerOrder = 5) {
  let invoiceCounter = 1000; // Starting invoice number
  let salesLineCounter = 1; // Starting sales line number
  
  const orders = [];
  
  for (let i = 0; i < numOrders; i++) {
    // Generate a new invoice
    const InvoiceNo = `INV${invoiceCounter++}`;
    const invoiceItems = [];
    salesLineCounter = 1; // Reset sales line number for each new invoice
    let totalLineAmount = 0; // Initialize total line amount for the order
  
    const numItems = Math.floor(Math.random() * maxItemsPerOrder) + 1; // Random number of items for each order
  
    for (let j = 0; j < numItems; j++) {
      // Generate an order line (sales line)
      const unit_price = parseFloat((Math.random() * 100).toFixed(2)); // Random unit price between 0 and 100
      const quantity = Math.floor(Math.random() * 100) + 1; // Random quantity between 1 and 100
      const line_amount_incl_vat = parseFloat((unit_price * quantity * 1.2).toFixed(2)); // Includes 20% VAT

      // Accumulate total line amount for the order
      totalLineAmount += line_amount_incl_vat;

      const item = {
        sales_line_no: salesLineCounter++, // Sequential sales line number
        item_code: `ITEM${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        quantity,
        unit_of_measure: ["PCS", "BOX", "KG"][Math.floor(Math.random() * 3)], // Random unit of measure
        product_specifications: Math.random() > 0.5 ? "Specification A" : "", // Random specification
        unit_price,
        line_amount_incl_vat
      };
      invoiceItems.push(item);
    }
  
    // Construct the order with details, items, and totals
    const order = {
      InvoiceNo,
      CUInvoiceNo: `CU${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      CUDateTime: new Date().toISOString(),
      CUNo: `CUN${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      customer_code: `CUST${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      shipment_date: new Date().toISOString().slice(0, 10), // Format as YYYY-MM-DD
      sales_code: `SALE${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      ship_to_code: `SHIP${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      ship_to_name: "Customer Shipping Location",
      status: ["Shipped", "Pending", "Delivered"][Math.floor(Math.random() * 3)], // Random status
      customer_specification: Math.random() > 0.5 ? "Custom Spec A" : "", // Random customer specification
      qr_code_url: `https://example.com/qrcode/${InvoiceNo}`, // Simulated QR code URL
      invoice_items: invoiceItems,
      line_item_count: invoiceItems.length, // Total number of line items
      total_line_amount: parseFloat(totalLineAmount.toFixed(2)) // Sum of line amounts with VAT
    };
  
    orders.push(order);
  }
  
  return orders;
}

// Example usage
// const generatedOrders = generateOrders(3, 5); // Generate 3 orders with up to 5 items each
// console.log(JSON.stringify(generatedOrders, null, 2));
