// slaughterDataGenerator.js

// Import data from repo.js
import { items, vendors } from "../repo.js";

// Helper function to get a random element from an array
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export const generateSlaughterData = (numReceipts = 3, maxLinesPerReceipt = 5) => {
  let receiptCounter = 52972;

  const receipts = [];
  for (let i = 0; i < numReceipts; i++) {
    const receipt_no = `FRT-${String(receiptCounter++).padStart(8, '0')}`;
    const slaughterLines = [];
    let lineCounter = 1;

    const numLines = Math.floor(Math.random() * maxLinesPerReceipt) + 1;
    for (let j = 0; j < numLines; j++) {
      const actual_weight = (Math.random() * 100 + 50).toFixed(1); // Random weight between 50 and 150
      const net_weight = (actual_weight - 2.5).toFixed(1); // Net weight is actual weight minus 2.5
      const settlement_weight = (net_weight * 0.975).toFixed(1); // Settlement weight is 97.5% of net weight
      const meat_percent = (Math.random() * (12 - 7) + 7).toFixed(1); // Random meat percent between 7 and 12

      const line = {
        line_no: lineCounter++,
        slapmark: String(Math.floor(Math.random() * 5000) + 1000),
        item_code: getRandomElement(items).item_code,
        vendor_no: getRandomElement(vendors).No_,
        vendor_name: getRandomElement(vendors).Name,
        actual_weight,
        net_weight,
        settlement_weight,
        meat_percent,
        classification_code: ["CLS01", "CLS02", "CLS03"][Math.floor(Math.random() * 3)],
        manual_weight: Math.random() > 0.5 ? 0 : Math.floor(Math.random() * 100),
        user_id: String(Math.floor(Math.random() * 10) + 1),
        is_imported: Math.random() > 0.5
      };
      slaughterLines.push(line);
    }

    receipts.push({ receipt_no, slaughter_lines: slaughterLines });
  }
  return receipts;
};
