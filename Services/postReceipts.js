// utils.js (or any utility file)

let receiptCounter = 53132; // Starting receipt number

// Function to generate a new receipt number
export const generateReceiptNo = () => {
  return `FRT-${String(receiptCounter++).padStart(8, '0')}`;
};
