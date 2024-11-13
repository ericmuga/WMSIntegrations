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
    // print(pdfDirPath, printedDirPath)
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
 
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const totalPages = 1;
    doc.text(`Page 1 of ${totalPages}`, 190, 20, { align: 'right' });

    const availableParts = [...new Set(data.lines.map(line => line.part))];
    const partsText = availableParts.join('|');

    doc.setFontSize(14);
    doc.text(`DISPATCH Packing List ${part}        OF ${partsText}`, 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text('DSP+0000563937', 25, 30)

    doc.text('11/7/2024 8:12:02 PM +03:00', 200, 30, { align: 'right' })

    // ----------------Line----------------
    doc.text('Order Date:', 10, 40)
    doc.text('11/7/2024 12:00:00 AM', 50, 40)

    doc.text('Sell To Address:', 120, 40)
    doc.text('Naivas - Kitui', 160, 40)

    // ----------------Line----------------
    doc.text('Order No.:', 10, 50)
    doc.text('S+ORD0000563937', 50, 50)

    doc.text('Sales Person:', 120, 50)
    doc.text('019', 160, 50)

    // ----------------Line----------------
    doc.text('Customer No.:', 10, 60)
    doc.text('240', 50, 60)

    doc.text('Sales Type:', 120, 60)
    doc.text('Direct Sales', 160, 60)

    // ----------------Line----------------
    doc.text('Customer Name:', 10, 70)
    doc.text('Naivas Limited', 50, 70)

    doc.text('Delivery Date:', 120, 70)
    doc.text('11/7/2024 12:00:00 AM', 160, 70)

    // ----------------Line----------------
    doc.text('External DocNo:', 10, 80)
    doc.text('N/A', 50, 80)

    doc.text('Ship To Name:', 120, 80)
    doc.text('Naivas - Kitui', 160, 80)

    // ----------------Line----------------
    doc.text('PDA Order:', 10, 90)
    doc.text('No', 50, 90)

    doc.text('Cust Ref. No:', 120, 90)
    doc.text('N/A', 160, 90)

    // ----------------Line----------------
    doc.text('Order Receiver:', 10, 100)
    doc.text('FARMERSCHOICE\EMUGA', 50, 100)

    doc.text('EXT Doc. No:', 120, 100)
    doc.text('N/A', 160, 100)

    // ----------------Line----------------
    doc.text('Your Ref:', 10, 110)
    doc.text('N/A', 50, 110)

    doc.text('District Group:', 120, 110)
    doc.text('Machakos', 160, 110)

    // ----------------Line----------------
    doc.text('Location:', 10, 120)
    doc.text('3535', 50, 120)

    doc.setFontSize(8);
    doc.text('Time Stamp:', 163, 130)
    doc.text('241107201159', 200, 130, { align: 'right' })

    doc.text('Serial No:', 175, 135)
    doc.text('1032279', 200, 135, { align: 'right' })

    doc.setFontSize(10);

    const tableColumnNames = [
        'Item No.', 'Description', 'Cust. Specs', 'Unit of Measure',
        'Order Qty', 'QTY Supplied', 'No. Of Cartons', 'Carton Serial No.'
    ];

    const tableData = lines.map(line => [
        line.item_no,
        line.description,
        line.custom_specs,
        line.unit_of_measure,
        line.order_qty,
        line.qty_supplied || '_______',
        line.cartons_count || '_______',
        line.carton_serial || '___________'
    ]);

    doc.autoTable({
        head: [tableColumnNames],
        body: tableData,
        startY: 130,
        columnStyles: {
            0: { cellWidth: 20, fillColor: null },
            1: { cellWidth: 40, fillColor: null },
            2: { cellWidth: 20, fillColor: null },
            3: { cellWidth: 20, fillColor: null },
            4: { cellWidth: 20, fillColor: null },
            5: { cellWidth: 20, fillColor: null },
            6: { cellWidth: 20, fillColor: null },
            7: { cellWidth: 30, fillColor: null },
        },
        headStyles: {
            fillColor: null,
            textColor: [0, 0, 0],
            fontSize: 9,
            fontStyle: 'bold',
        },
        didDrawCell: (data) => {
            if (data.row.index === 0 && data.section === 'head') {
                const { table } = data;
                const startX = table.head[0].x;
                const endX = startX + table.width;
                const y = data.cell.y + data.cell.height;

                doc.setDrawColor(0);
                doc.setLineWidth(0.5);
                doc.line(15, y, 200, y);
            }
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
                data.cell.styles.fontStyle = 'bold'
                data.cell.styles.fontSize = 10
            }

            data.cell.styles.textColor = [0, 0, 0]
        },
    });

    doc.setFont("helvetica", "normal");
    doc.text('Total Order Quantity: 1', 105, doc.lastAutoTable.finalY + 10, { align: 'center' });

    doc.setFont("helvetica", "bold");
    // ----------------Line----------------
    doc.text('Prepared By (Name & Sign):', 10, doc.lastAutoTable.finalY + 98);
    doc.setDrawColor(0);
    doc.setLineWidth(0.1); 
    doc.rect(10 /*X*/, doc.lastAutoTable.finalY + 100 /*Y*/, 60 /*Width*/, 12 /*Height*/, 'S'); // 'S' for stroke only

    doc.text('Packed By (Name & Sign):', 75, doc.lastAutoTable.finalY + 98);
    doc.setDrawColor(0);
    doc.setLineWidth(0.1); 
    doc.rect(75 /*X*/, doc.lastAutoTable.finalY + 100 /*Y*/, 60 /*Width*/, 12 /*Height*/, 'S'); // 'S' for stroke only

    doc.text('Checked By (Name & Sign):', 140, doc.lastAutoTable.finalY + 98);
    doc.setDrawColor(0);
    doc.setLineWidth(0.1); 
    doc.rect(140 /*X*/, doc.lastAutoTable.finalY + 100 /*Y*/, 60 /*Width*/, 12 /*Height*/, 'S'); // 'S' for stroke only

    
    doc.text('Total Net Weight: ___________', 75, doc.lastAutoTable.finalY + 118);
    doc.text('Total Gross Weight: ___________', 75, doc.lastAutoTable.finalY + 123);
    doc.text('Total No. Of Cartons: ___________', 75, doc.lastAutoTable.finalY + 128);

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
