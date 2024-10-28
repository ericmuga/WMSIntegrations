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

// Template data for consumption journal lines to be reused
const consumptionJournalLineTemplate = [
  { ItemNo: "G2044", Quantity: 5, uom: "KG", LocationCode: "3535", BIN: "", line_no: 2000 },
  { ItemNo: "G2001", Quantity: 3, uom: "KG", LocationCode: "3535", BIN: "", line_no: 3000 }
];

// Function to create a journal line with type, current date, and user
function createJournalLine(journalLine, user, type) {
  return {
    ...journalLine,
    type, // Add type (consumption or output)
    date_time: getCurrentDateTime(),
    user
  };
}

// Function to generate a sample production order data
export function generateProductionOrderData() {
  const items = [
    { ItemNo: "J31031702", Quantity: 10, uom: "PC", LocationCode: "3535", BIN: "", user:"EMUGA", line_no: 1000 }
  ];

  return items.map(item => {
    const productionOrderNo = generateUniqueProductionOrderNo();

    // Create the output journal line based on production order header details
    const outputJournalLine = createJournalLine(
      {
        ItemNo: item.ItemNo,
        Quantity: item.Quantity,
        uom: item.uom,
        LocationCode: item.LocationCode,
        BIN: item.BIN,
        line_no: item.line_no
      },
      item.user,
      "output"
    );

    // Create consumption lines and add output line to the journal lines
    const ProductionJournalLines = [
      outputJournalLine,
      ...consumptionJournalLineTemplate.map(journalLine => createJournalLine(journalLine, item.user, "consumption"))
    ];

    // Return the production order with header details and journal lines
    return {
      production_order_no: productionOrderNo,
      ...item,
      routing: "production_order.bc",
      date_time: getCurrentDateTime(),
      ProductionJournalLines
    };
  });
}

// Uncomment to test the function output
// console.log(generateProductionOrderData());
