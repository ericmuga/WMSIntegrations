import xlsx from 'xlsx';
import fs from 'fs';

const transformExcelToJson = (filePath) => {
    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Get the first sheet
    const sheet = workbook.Sheets[sheetName];

    // Convert the sheet data to JSON
    const data = xlsx.utils.sheet_to_json(sheet);

    // Group data by Location Code
    const groupedData = data.reduce((acc, row) => {
        const { ItemNo, "Location Code": locationCode } = row;

        if (!acc[locationCode]) {
            acc[locationCode] = [];
        }
        acc[locationCode].push(ItemNo);

        return acc;
    }, {});

    return groupedData;
};

// Example usage
const filePath = './Services/Utils/rawLocations.xlsx'; // Replace with your file path
const groupedJson = transformExcelToJson(filePath);

// Save the output to a JSON file (optional)
fs.writeFileSync('./Services/Utils/groupedLocations.json', JSON.stringify(groupedJson, null, 2), 'utf-8');

console.log(groupedJson);
