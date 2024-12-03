// Mock data for testing
const mockSalesLines = [
  {
    sales_order_no: "ORD12345",
    sales_line_no: 10000,
    item_code: "ITEM001",
    quantity: 50,
    quantity_shipped: 30,
    quantity_remaining: 20,
    return_reason: "Damaged", // Added return reason
    company:"FCL"
  },
  {
    sales_order_no: "ORD12345",
    sales_line_no: 20000,
    item_code: "ITEM002",
    quantity: 100,
    quantity_shipped: 80,
    quantity_remaining: 20,
    return_reason: "Short Supply", // Added return reason
    company:"FCL"
  },
  {
    sales_order_no: "ORD12346",
    sales_line_no: 10000,
    item_code: "ITEM003",
    quantity: 75,
    quantity_shipped: 50,
    quantity_remaining: 25,
    return_reason: "Wrong Item", // Added return reason
    company:"FCL"
  },
];

/**
 * Fetch sales lines with optional order number filter.
 * @param {string|null} orderNo - Optional sales order number to filter.
 * @returns {Promise<Array>} - List of sales lines with executed quantities and return reasons.
 */
export async function fetchOrderLines(orderNo = null, company = null) {
  console.log("Using mock sales lines data...");

  // Filter mock data based on order number and company
  const filteredLines = mockSalesLines.filter((line) => {
    const matchesOrder = !orderNo || line.sales_order_no === orderNo;
    const matchesCompany = !company || line.company === company;
    return matchesOrder && matchesCompany;
  });

  return Promise.resolve(filteredLines);
}
