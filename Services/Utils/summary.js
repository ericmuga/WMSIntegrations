import xlsx from 'xlsx';
import fs from 'fs';

// Read the Excel file
const filePath = '13thMay.xlsx'; // Change to your file path
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert the sheet data to JSON
const data = xlsx.utils.sheet_to_json(worksheet);

// Function to group and sum the data based on the required columns
const groupAndSumData = (data) => {
  const groupedData = {};

  data.forEach(row => {
    // Ensure the Quantity is treated as a number
    const quantity = Number(row.Quantity);

    // Check if the Quantity is a valid number
    if (isNaN(quantity)) {
      console.warn(`Invalid quantity at row: ${JSON.stringify(row)}`);
      return; // Skip invalid rows
    }

    // Group key based on ItemNo, EntryType, LocationCode, UnitOfMeasure, and OutputItem
    const groupKey = `${row['Item No.']}|${row['EntryType']}|${row['Location Code']}|${row['Unit of Measure']}|${row['OutputItem']}`;

    if (!groupedData[groupKey]) {
      // Initialize with first entry for the group
      groupedData[groupKey] = { ...row, Quantity: quantity };
    } else {
      // Sum the Quantity for the same group
      groupedData[groupKey].Quantity += quantity;
    }
  });

  return Object.values(groupedData);
};

// Transform the data
const transformedData = groupAndSumData(data);

// Convert the transformed data back to Excel
const newWorkbook = xlsx.utils.book_new();
const newWorksheet = xlsx.utils.json_to_sheet(transformedData);
xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, 'Grouped Data');

// Write the transformed data to a new Excel file
const outputFilePath = '13thMayS.xlsx'; // Change to desired output path
xlsx.writeFile(newWorkbook, outputFilePath);

console.log('Data transformation completed. Transformed file saved to:', outputFilePath);
