// slaughterDataGenerator.js

export const generateSlaughterData = (numReceipts = 3, maxLinesPerReceipt = 5) => {
    let receiptCounter = 52972;
  
    const receipts = [];
    for (let i = 0; i < numReceipts; i++) {
      const receipt_no = `FRT-${String(receiptCounter++).padStart(8, '0')}`;
      const slaughterLines = [];
      let lineCounter = 1;
  
      const numLines = Math.floor(Math.random() * maxLinesPerReceipt) + 1;
      for (let j = 0; j < numLines; j++) {
        const line = {
          line_no: lineCounter++,
          slapmark: String(Math.floor(Math.random() * 5000) + 1000),
          item_code: `G${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
          vendor_no: `PF${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
          vendor_name: ["Christopher", "Alex", "Jordan", "Taylor"][Math.floor(Math.random() * 4)],
          actual_weight: (Math.random() * 100 + 50).toFixed(1),
          net_weight: (Math.random() * 100).toFixed(1),
          settlement_weight: (Math.random() * 100).toFixed(1),
          meat_percent: (Math.random() * 100).toFixed(1),
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
  