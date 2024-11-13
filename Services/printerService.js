// printerService.js

import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const printInit = (data) => {
    // Resolve __dirname in ES module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const pdfDirPath = path.resolve(__dirname, '../pdf');
    if (!fs.existsSync(pdfDirPath)) {
        fs.mkdirSync(pdfDirPath);
    }

    const printedDirPath = path.resolve(__dirname, '../printed');
    if (!fs.existsSync(printedDirPath)) {
        fs.mkdirSync(printedDirPath);
    }

    // Process incoming data and generate print files
    // Group lines by part
    const partsMap = data.lines.reduce((accumulator, line) => {
        console.log('acumulator',)
        const { part } = line;
        const key = `${data.order_no}_${part}`;

        if (!accumulator[key]) {
            accumulator[key] = [];
        }
        accumulator[key].push(line);
        return accumulator;
    }, {});

    // Generate PDF for each group
    Object.entries(partsMap).forEach(([key, lines]) => {
        const [itemNo, part] = key.split('_');
        createPDF(data, pdfDirPath, itemNo, part, lines);
    });

    // Initialize printing
    // print(pdfDirPath, printedDirPath)
}

const createPDF = (data, pdfDirPath, itemNo, part, lines) => {
    const fileName = `${itemNo}_${part}.pdf`;
    const filePath = path.join(pdfDirPath, fileName);

    const doc = new jsPDF('p', 'mm', 'a4'); // A4 size page

    doc.setFont("helvetica", "bold");

    // Pagination
    const totalPages = () => doc.getNumberOfPages();
    const addPageNumber = () => {
        const pageCount = totalPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            // doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' }); // Appears at the footer
            doc.text(`Page ${i} of ${pageCount}`, 190, 19, { align: 'right' });
        }
    };

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
    doc.text(data.shp_name, 160, 40)

    // ----------------Line----------------
    doc.text('Order No.:', 10, 50)
    doc.text(data.order_no, 50, 50)

    doc.text('Sales Person:', 120, 50)
    doc.text(data.sp_code, 160, 50)

    // ----------------Line----------------
    doc.text('Customer No.:', 10, 60)
    doc.text(data.customer_no, 50, 60)

    doc.text('', 120, 60)
    doc.text(data.sp_name, 160, 60)

    // ----------------Line----------------
    doc.text('Customer Name:', 10, 70)
    doc.text(data.customer_name, 50, 70)

    doc.text('Delivery Date:', 120, 70)
    doc.text(`${data.ending_date} ${data.ending_time}`, 160, 70)

    // ----------------Line----------------
    doc.text('External DocNo:', 10, 80)
    doc.text('N/A', 50, 80)

    doc.text('Ship To Name:', 120, 80)
    doc.text(data.shp_name, 160, 80)

    // ----------------Line----------------
    doc.text('PDA Order:', 10, 90)
    doc.text(data.pda ? 'Yes' : 'No', 50, 90)

    doc.text('Cust Ref. No:', 120, 90)
    doc.text('N/A', 160, 90)

    // ----------------Line----------------
    doc.text('Order Receiver:', 10, 100)
    doc.text(data.ended_by, 50, 100)

    doc.text('EXT Doc. No:', 120, 100)
    doc.text(data.ext_doc_no, 160, 100)

    // ----------------Line----------------
    doc.text('Your Ref:', 10, 110)
    doc.text('N/A', 50, 110)

    doc.text('District Group:', 120, 110)
    doc.text('MACHAKOS', 160, 110)

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
        line.item_description,
        line.customer_spec,
        line.unit_of_measure,
        line.order_qty,
        line.qty_supplied || '_______',
        line.cartons_count || '_______',
        line.carton_serial || '___________'
    ]);

    doc.autoTable({
        head: [tableColumnNames],
        body: tableData,
        startY: 140,
        margin: { top: 30, bottom: 80 },
        columnStyles: {
            0: { cellWidth: 20, fillColor: null, halign: 'center' },
            1: { cellWidth: 40, fillColor: null },
            2: { cellWidth: 20, fillColor: null },
            3: { cellWidth: 20, fillColor: null, halign: 'center' },
            4: { cellWidth: 20, fillColor: null, halign: 'center' },
            5: { cellWidth: 20, fillColor: null, halign: 'center' },
            6: { cellWidth: 20, fillColor: null, halign: 'center' },
            7: { cellWidth: 30, fillColor: null, halign: 'left' },
        },
        headStyles: {
            fillColor: null,
            textColor: [0, 0, 0],
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
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
        didDrawPage: (data) => {
            const footerY = 250; // Fixed Y position for the footer

            doc.setFont("helvetica", "bold");
            doc.text('Prepared By (Name & Sign):', 10, footerY);
            doc.rect(10 /*X*/, footerY + 2 /*Y*/, 60 /*Width*/, 12 /*Height*/, 'S' /*'S' for stroke only*/);

            doc.text('Packed By (Name & Sign):', 75, footerY);
            doc.rect(75, footerY + 2, 60, 12, 'S');

            doc.text('Checked By (Name & Sign):', 140, footerY);
            doc.rect(140, footerY + 2, 60, 12, 'S');

            doc.text('Total Net Weight: ___________', 75, footerY + 20);
            doc.text('Total Gross Weight: ___________', 75, footerY + 25);
            doc.text('Total No. Of Cartons: ___________', 75, footerY + 30);
        },
    });

    doc.setFont("helvetica", "normal");
    doc.text('Total Order Quantity: 1', 105, doc.lastAutoTable.finalY + 10, { align: 'center' });

    addPageNumber();

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
