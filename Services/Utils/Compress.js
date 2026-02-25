import xlsx from 'xlsx';
import fs from 'fs';

const readExcelFile = (filePath) => {
  // Read the Excel file
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];  // Assuming the data is in the first sheet
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });  // Convert sheet to an array of rows
  
  return data;
};

const transformData = (data) => {
  let productionOrders = [];
  let productionOrderNo = "";
  let entryType = "";
  let itemNo = "";
  let uom = "";
  let locationCode = "";
  let lineNo = 1000;  // Starting line number
  let datetime = new Date().toISOString();

  data.forEach(row => {
    if (row[0]?.startsWith('P00')) {
      // New production order
      productionOrderNo = row[0];  // e.g., P00_G1030_050425
      return;
    }
    if (row[0] === 'Consumption' || row[0] === 'Output') {
      // Handle entry types (Output or Consumption)
      entryType = row[0];
    } else {
      // Process the remaining data
      const itemDetails = {
        productionOrderNo,
        lineNo,
        itemNo: row[0],
        quantity: row[1],  // Assuming quantity is in the next column
        unitOfMeasure: uom,
        locationCode,
        binCode: '',
        entryType,
        dateTime: datetime,
        user: 'DKIBOWEN',  // Hardcoded for now
        status: 'Pending',
        error: false,
        errorMessage: ''
      };
      productionOrders.push(itemDetails);
      lineNo += 1000;  // Increment line number
    }
  });

  return productionOrders;
};

const exportToCSV = (data, outputFilePath) => {
  const headers = [
    'Production Order No.', 'Line No.', 'Item No.', 'Quantity', 'Unit of Measure', 'Location Code', 'Bin Code',
    'EntryType', 'Date Time', 'User', 'Status', 'Error', 'Error Message'
  ];
  const rows = data.map(row => [
    row.productionOrderNo, row.lineNo, row.itemNo, row.quantity, row.unitOfMeasure, row.locationCode, row.binCode,
    row.entryType, row.dateTime, row.user, row.status, row.error, row.errorMessage
  ]);

  const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');

  fs.writeFileSync(outputFilePath, csvContent, 'utf8');
};

const main = () => {
  const inputFilePath = '129.xlsx';  // Replace with your file path
  const outputFilePath = '130.csv';  // Replace with your desired output path

  const excelData = readExcelFile(inputFilePath);
  const transformedData = transformData(excelData);
  exportToCSV(transformedData, outputFilePath);

  console.log('Data has been transformed and exported to CSV.');
};

main();
