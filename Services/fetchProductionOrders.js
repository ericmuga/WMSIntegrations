// productionOrderGenerator.js

let productionOrderCounter = 1;

// Function to generate a unique production order number (e.g., PO001, PO002, etc.)
export function generateUniqueProductionOrderNo() {
    const paddedCounter = String(productionOrderCounter).padStart(3, '0');
    productionOrderCounter++; // Increment after generating the current order number
    return `PO${paddedCounter}`;
  }
  

// Function to get the current date and time in ISO format
export function getCurrentDateTime() {
  return new Date().toISOString();
}

// Template data for journal lines to be reused
const journalLineTemplate = [
  { ItemNo: "G2044", Quantity: 5, uom: "KG", LocationCode: "3535", BIN: "" },
  { ItemNo: "G2001", Quantity: 3, uom: "KG", LocationCode: "3535", BIN: "" }
];

// Function to create a journal line with current date and user
function createJournalLine(journalLine, user) {
  return {
    ...journalLine,
    date_time: getCurrentDateTime(),
    user
  };
}

// Function to generate a sample production order data
export function generateProductionOrderData() {
  const items = [
    { ItemNo: "J31031702", Quantity: 10, uom: "PCS", LocationCode: "3535", BIN: "BIN001", user: "user1" },
    { ItemNo: "J31015401", Quantity: 20, uom: "PCS", LocationCode: "1234", BIN: "BIN002", user: "user2" },
    { ItemNo: "J31070102", Quantity: 15, uom: "PCS", LocationCode: "5678", BIN: "BIN003", user: "user3" },
    { ItemNo: "J31045123", Quantity: 12, uom: "PCS", LocationCode: "9876", BIN: "BIN004", user: "user4" }
  ];

  return items.map(item => ({
    production_order_no: generateUniqueProductionOrderNo(),
    ...item,
    routing: "production_order.bc",
    date_time: getCurrentDateTime(),
    ProductionJournalLines: journalLineTemplate.map(journalLine => createJournalLine(journalLine, item.user))
  }));
}
 
// console.log(generateProductionOrderData());