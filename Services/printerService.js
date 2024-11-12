// printerService.js

import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit-table';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable'; // For table generation support

export const printInit = (data) => {
    // Init directories
    // Resolve __dirname in ES module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Define the folder paths
    const pdfDirPath = path.resolve(__dirname, '../pdf');
    if (!fs.existsSync(pdfDirPath)) {
        fs.mkdirSync(pdfDirPath);
    }

    console.log("Folder path:", pdfDirPath);

    const printedDirPath = path.resolve(__dirname, '../printed');
    if (!fs.existsSync(printedDirPath)) {
        fs.mkdirSync(printedDirPath);
    }
    console.log("Printed folder path:", printedDirPath);


    // Process incoming data and generate print files
    // Group lines by part
    const partsMap = data.lines.reduce((acc, line) => {
        const { part, item_no } = line;
        const key = `${item_no}_${part}`;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(line);
        return acc;
    }, {});

    // Generate PDF for each group
    Object.entries(partsMap).forEach(([key, lines]) => {
        const [itemNo, part] = key.split('_');
        createPDFAlt(data, pdfDirPath, itemNo, part, lines);
    });

    // Initialize printing
    print(pdfDirPath, printedDirPath)
}

const createPDF = (data, pdfDirPath, itemNo, part, lines) => {
    const fileName = `${itemNo}_${part}.pdf`;
    const filePath = path.join(pdfDirPath, fileName);

    const doc = new PDFDocument({ size: 'A4', margin: 30 });
    doc.pipe(fs.createWriteStream(filePath));

    // Pagination (Top right corner)
    const totalPages = 1;
    doc.font('Helvetica').fontSize(10)
        .text(`Page 1 of ${totalPages}`, 480, 20, { align: 'right' });

    // Header section (centered)
    doc.moveTo(30, 40);
    doc.fontSize(18)
        .text(`DISPATCH Packing List ${part}`, 0, 50, { align: 'center', width: 540 })
        .moveDown();

    doc.fontSize(12)
        .text('FarmersChoice/Emuga', 0, 75, { align: 'center', width: 540 })
        .text('11/7/2024 8:12:02 PM +03:00', 0, 90, { align: 'center', width: 540 })
        .moveDown();

    // Order details section (left-aligned)
    doc.fontSize(10)
        .text('Order No.: DSP+0000563937', 30)
        .moveDown()
        .text('Delivery Date: 11/7/2024 12:00:00 AM', 30)
        .moveDown()
        .text('Order Date: 11/7/2024 12:00:00 AM', 30)
        .moveDown()
        .text('Customer Name: Naivas Limited', 30)
        .moveDown()
        .text('Ship To: Naivas - Kitui', 30)
        .moveDown()
        .text('Customer No.: 240', 30)
        .moveDown();

    // Table header
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Pick Instruction', 30, undefined, { underline: true }).moveDown();

    const table = {
        headers: [
            { label: 'Item No.', width: 70 },
            { label: 'Description', width: 150 },
            { label: 'Cust. Specs', width: 70 },
            { label: 'Unit of Measure', width: 70 },
            { label: 'Order Qty', width: 60 },
            { label: 'QTY Supplied', width: 70 },
            { label: 'No. Of Cartons', width: 70 },
            { label: 'Carton Serial No.', width: 100 }
        ],
        datas: lines.map(line => [
            line.item_no,
            line.description,
            line.custom_specs || 'N/A',
            line.unit_of_measure,
            line.order_qty,
            line.qty_supplied,
            line.cartons_count || 'N/A',
            line.carton_serial || 'N/A'
        ])
    };

    // Draw the table without header background color
    doc.font('Helvetica').fontSize(10);
    const options = {
        columnsSize: [70, 150, 70, 70, 60, 70, 70, 100],
        rowHeight: 20,
        prepareHeader: () => {
            doc.font('Helvetica-Bold').fontSize(10)
        }, 
        prepareRow: () => doc.font('Helvetica').fontSize(10),
        columnSpacing: 5,
        align: 'left'
    };
    doc.table(table, options);

    // Footer section (left-aligned)
    doc.moveDown()
        .text('Total Order Quantity: 1', 30)
        .text('Prepared By: (Name & Sign)', 30)
        .text('Packed By: (Name & Sign)', 30)
        .text('Total Net Weight: ___________', 30)
        .text('Total Gross Weight: ___________', 30)
        .text('Total No. Of Cartons: ___________', 30)
        .text('Checked By: (Name & Sign)', 30)
        .moveDown();

    // Additional info (left-aligned)
    doc.text('Order Receiver: Location: 3535', 30)
        .text('Salesperson: 019', 30)
        .text('MACHAKOS', 0, undefined, { align: 'center', width: 540 });

    // Finalize the PDF
    doc.end();
};

const createPDFAlt = (data, pdfDirPath, itemNo, part, lines) => {
    const fileName = `${itemNo}_${part}.pdf`;
    const filePath = path.join(pdfDirPath, fileName);

    const doc = new jsPDF('p', 'mm', 'a4'); // A4 size page

    // Pagination (Top right corner)
    const totalPages = 1; // You can calculate the total pages dynamically
    doc.setFontSize(10);
    doc.text(`Page 1 of ${totalPages}`, 190, 10, { align: 'right' });

    // Header section (centered)
    doc.setFontSize(18);
    doc.text(`DISPATCH Packing List ${part}`, 105, 50, { align: 'center' });
    doc.setFontSize(12);
    doc.text('FarmersChoice/Emuga', 105, 60, { align: 'center' });
    doc.text('11/7/2024 8:12:02 PM +03:00', 105, 70, { align: 'center' });

    // Order details section (left-aligned)
    doc.setFontSize(10);
    doc.text('Order No.: DSP+0000563937', 10, 85);
    doc.text('Delivery Date: 11/7/2024 12:00:00 AM', 10, 95);
    doc.text('Order Date: 11/7/2024 12:00:00 AM', 10, 105);
    doc.text('Customer Name: Naivas Limited', 10, 115);
    doc.text('Ship To: Naivas - Kitui', 10, 125);
    doc.text('Customer No.: 240', 10, 135);

    // Table header
    const tableColumnNames = [
        'Item No.', 'Description', 'Cust. Specs', 'Unit of Measure', 
        'Order Qty', 'QTY Supplied', 'No. Of Cartons', 'Carton Serial No.'
    ];

    const tableData = lines.map(line => [
        line.item_no,
        line.description,
        line.custom_specs || 'N/A',
        line.unit_of_measure,
        line.order_qty,
        line.qty_supplied,
        line.cartons_count || 'N/A',
        line.carton_serial || 'N/A'
    ]);

    // Draw table using jsPDF autotable plugin
    doc.autoTable({
        head: [tableColumnNames],
        body: tableData,
        startY: 145,
        columnStyles: {
            0: { cellWidth: 20, fillColor: null }, // No fill color for Item No.
            1: { cellWidth: 50, fillColor: null }, // No fill color for Description
            2: { cellWidth: 20, fillColor: null }, // No fill color for Cust. Specs
            3: { cellWidth: 20, fillColor: null }, // No fill color for Unit of Measure
            4: { cellWidth: 20, fillColor: null }, // No fill color for Order Qty
            5: { cellWidth: 20, fillColor: null }, // No fill color for QTY Supplied
            6: { cellWidth: 20, fillColor: null }, // No fill color for No. Of Cartons
            7: { cellWidth: 30, fillColor: null }, // No fill color for Carton Serial No.
        },
        headStyles: {
            fillColor: null, // Remove header background color
            textColor: [0, 0, 0], // Optional: Set header text color to black
            fontSize: 10, // Optional: Adjust font size for header
            fontStyle: 'bold', // Optional: Make header text bold
        }
    });

    // Footer section (left-aligned)
    doc.text('Total Order Quantity: 1', 10, doc.lastAutoTable.finalY + 10);
    doc.text('Prepared By: (Name & Sign)', 10, doc.lastAutoTable.finalY + 20);
    doc.text('Packed By: (Name & Sign)', 10, doc.lastAutoTable.finalY + 30);
    doc.text('Total Net Weight: ___________', 10, doc.lastAutoTable.finalY + 40);
    doc.text('Total Gross Weight: ___________', 10, doc.lastAutoTable.finalY + 50);
    doc.text('Total No. Of Cartons: ___________', 10, doc.lastAutoTable.finalY + 60);
    doc.text('Checked By: (Name & Sign)', 10, doc.lastAutoTable.finalY + 70);

    // Additional info (left-aligned)
    doc.text('Order Receiver: Location: 3535', 10, doc.lastAutoTable.finalY + 80);
    doc.text('Salesperson: 019', 10, doc.lastAutoTable.finalY + 90);
    doc.text('MACHAKOS', 105, doc.lastAutoTable.finalY + 100, { align: 'center' });

    // Save the PDF
    doc.save(filePath);
};

const print = (pdfDirPath, printedDirPath) => {
    // Read files in the folder
    fs.readdir(pdfDirPath, (err, files) => {
        if (err) {
            console.error(`Error reading folder: ${err.message}`);
            return;
        }

        // Loop through each file
        files.forEach((file) => {
            const filePath = path.join(pdfDirPath, file);
            const printedFilePath = path.join(printedDirPath, file);

            // Check if it's a file (not a directory)
            if (fs.statSync(filePath).isFile()) {
                // Use print command to send the file to the default printer
                exec(`print /D:"HP LaserJet Pro M404-M405 PCL-6 (V4)" "${filePath}"`, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error printing ${file}: ${error.message}`);
                    } else if (stderr) {
                        console.error(`Error printing ${file}: ${stderr}`);
                    } else {
                        console.log(`Print job for ${file} sent successfully.`);

                        // Move the file to the "printed" folder after printing
                        fs.rename(filePath, printedFilePath, (moveErr) => {
                            if (moveErr) {
                                console.error(`Error moving ${file} to printed folder: ${moveErr.message}`);
                            } else {
                                console.log(`${file} has been moved to the printed folder.`);
                            }
                        });
                    }
                });
            }
        });
    });
}
