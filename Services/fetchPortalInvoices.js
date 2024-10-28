import { customers, items, locations, salesPersons } from "../repo.js";

let invoiceCounter = 1000;

export function generateUniqueInvoiceNo() {
  const paddedCounter = String(invoiceCounter).padStart(4, '0');
  invoiceCounter++;
  return `INV${paddedCounter}`;
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function generateInvoices(numOrders = 3, maxItemsPerOrder = 5) {
  const orders = [];

  for (let i = 0; i < numOrders; i++) {
    const invoiceNo = generateUniqueInvoiceNo();
    const customer = getRandomElement(customers);
    const shipTo = getRandomElement(customer.ship_to_array);
    const salesPerson = getRandomElement(salesPersons); // Randomly select a sales person

    const invoiceItems = [];
    let totalLineAmount = 0;

    const numItems = Math.floor(Math.random() * maxItemsPerOrder) + 1;

    for (let j = 0; j < numItems; j++) {
      const item = getRandomElement(items);
      const unit_price = parseFloat((Math.random() * 100).toFixed(2));
      const quantity = Math.floor(Math.random() * 100) + 1;
      const line_amount_incl_vat = parseFloat((unit_price * quantity * 1.2).toFixed(2));

      totalLineAmount += line_amount_incl_vat;

      const invoiceItem = {
        sales_line_no: j + 1,
        item_code: item.item_code,
        quantity,
        unit_of_measure: item.unit_of_measure,
        unit_price,
        line_amount_incl_vat
      };
      invoiceItems.push(invoiceItem);
    }

    const CUInvoiceNo = `009${String(Math.floor(Math.random() * 1e13)).padStart(13, '0')}`;
    const currentYear = new Date().getFullYear();
    const CUNo = `KRAMW009${currentYear}${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    const qr_code = `https://itax.kra.go.ke/KRA-Portal/invoiceChk.htm?actionCode=loadPage&invoiceNo=${CUInvoiceNo}`;

    const order = {
      InvoiceNo: invoiceNo,
      CUInvoiceNo,
      CUDateTime: new Date().toISOString(),
      CUNo,
      customer_code: customer.cust_no,
      shipment_date: new Date().toISOString().slice(0, 10),
      sales_person_code: salesPerson.sp_code, // Add sales person code
      sales_person_name: salesPerson.name, // Sales person name for reference
      default_location: salesPerson.default_location, // Default location for the sales person
      ship_to_code: shipTo.shp_no,
      ship_to_name: shipTo.ship_to_name,
      status: ["Shipped", "Pending", "Delivered"][Math.floor(Math.random() * 3)],
      qr_code,
      invoice_items: invoiceItems,
      line_item_count: invoiceItems.length,
      total_line_amount: parseFloat(totalLineAmount.toFixed(2))
    };

    orders.push(order);
  }

  return orders;
}