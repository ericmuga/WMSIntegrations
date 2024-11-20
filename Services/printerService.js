// printerService.js
import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import pkg from 'pdf-to-printer';
import logger from '../logger.js';
const { getPrinters, print: sendToPrinter } = pkg;
import { companyParameter } from '../config/default.js';
export const defaultPrinter = 'Microsoft Print to PDF (redirected 2)';

const listPrinters = async () => {
    try {
        const printers = await getPrinters();
        console.log("Available Printers:");
        printers.forEach((printer, index) => {
            console.log(`${index + 1}: ${printer.name}`);
        });
    } catch (err) {
        console.error("Failed to retrieve printers:", err);
    }
};

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

    // Process incoming data and generate PDFs
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

    // Generate a PDF for each group
    Object.entries(partsMap).forEach(([key, lines]) => {
        const [itemNo, part] = key.split('_');
        createPDF(data, pdfDirPath, itemNo, part, lines);
    });

    printFromFolder(pdfDirPath, printedDirPath, defaultPrinter)
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

    const config = getCompanyConfig(data.company_flag.toLowerCase())

    doc.setFontSize(14);
    doc.text(`DISPATCH Packing List ${part}        OF ${partsText}`, 105, 20, { align: 'center' });
    doc.setFontSize(12);

    doc.text(`${config.parkingListPrefix}${data.order_no}`, 25, 30)

    doc.text(`${data.ending_date} ${data.ending_time}`, 200, 30, { align: 'right' }) // TODO

    // ----------------Line----------------
    doc.text('Order Date:', 10, 38)
    doc.text(data.shp_date, 50, 38)

    doc.text('Sell To Address:', 120, 38)
    doc.text(data.shp_name, 160, 38)

    // ----------------Line----------------
    doc.text('Order No.:', 10, 46)
    doc.text(`${config.orderPrefix}${data.order_no}`, 50, 46)

    doc.text('Load To Code:', 120, 46)
    doc.text(data.sp_code, 160, 46)

    // ----------------Line----------------
    doc.text('Customer No.:', 10, 54)
    doc.text(data.customer_no, 50, 54)

    doc.text('', 120, 54)
    doc.text(data.sp_name, 160, 54)

    // ----------------Line----------------
    doc.text('Customer Name:', 10, 62)
    doc.text(data.customer_name, 50, 62)

    doc.text('Delivery Date:', 120, 62)
    doc.text(data.shp_date, 160, 62)

    // ----------------Line----------------
    doc.text('External DocNo:', 10, 70)
    doc.text(data.ext_doc_no, 50, 70)

    doc.text('Ship To Name:', 120, 70)
    doc.text(data.shp_name, 160, 70)

    // ----------------Line----------------
    doc.text('PDA Order:', 10, 78)
    doc.text(data.pda ? 'Yes' : 'No', 50, 78)

    doc.text('Cust Ref. No:', 120, 78)
    doc.text('N/A', 160, 78)

    // ----------------Line----------------
    doc.text('Order Receiver:', 10, 86)
    doc.text(data.ended_by, 50, 86)

    // ----------------Line----------------
    doc.text('Your Ref:', 10, 94)
    doc.text('N/A', 50, 94)

    doc.text('Route:', 120, 94)
    doc.text(data.route_code, 160, 94)

    doc.setFontSize(8);
    doc.text('Time Stamp:', 162, 102)
    doc.text(Date.now().toString(), 200, 102, { align: 'right' })

    // doc.text('Serial No:', 175, 107)
    // doc.text('1032279', 200, 107, { align: 'right' }) // TODO

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
        startY: 115,
        margin: { left: 5, top: 30, bottom: 80 },
        columnStyles: {
            0: { cellWidth: 20, fillColor: null, halign: 'center' },
            1: { cellWidth: 50, fillColor: null, halign: 'center' },
            2: { cellWidth: 20, fillColor: null, halign: 'center' },
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
            if (data.section === 'head' && data.row.index === 0) {
                const lineY = data.cell.y + data.cell.height;
                doc.setDrawColor(0);
                doc.setLineWidth(0.5);
                doc.line(8, lineY, 203, lineY);
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
    doc.text(`Total Order Quantity: ${lines.length}`, 105, doc.lastAutoTable.finalY + 10, { align: 'center' });

    addPageNumber();

    // Save the PDF
    doc.save(filePath);
};

const getCompanyConfig = (flag) => {
    let config
    if (!flag)
        companyParameter['fcl'];

    config = companyParameter[flag];

    return config;
}


export const printFromFolder = async (pdfDirPath, printedDirPath, printerName) => {
    try {
        // Validate the printer name
        const printers = await getPrinters();
        const selectedPrinter = printers.find((printer) => printer.name === printerName);

        if (!selectedPrinter) {
            logger.error(`Printer "${printerName}" not found.`);
            return;
        }

        // Read files in the folder
        const files = await fs.promises.readdir(pdfDirPath);

        for (const file of files) {
            const filePath = path.join(pdfDirPath, file);
            const printedFilePath = path.join(printedDirPath, file);

            // Check if it's a file (not a directory)
            const fileStat = await fs.promises.stat(filePath);
            if (fileStat.isFile() && file.endsWith('.pdf')) {
                try {
                    // Send the PDF to the selected printer
                    await sendToPrinter(filePath, { printer: printerName });
                    logger.info(`Print job for ${file} sent successfully to printer "${printerName}".`);

                    // Move the file to the "printed" folder after printing
                    await fs.promises.rename(filePath, printedFilePath);
                    logger.info(`${file} has been moved to the printed folder.`);
                } catch (printErr) {
                    logger.error(`Error printing ${file}: ${printErr.message}`);
                }
            }
        }
    } catch (err) {
        logger.error(`Error: ${err.message}`);
    }
};


/**
 * Prints a single PDF file to the specified printer and optionally moves it to a printed folder.
 * 
 * @param {string} pdfFilePath - The full path of the PDF file to be printed.
 * @param {string} printedFolder - The folder to move the printed file to. If blank, the file is not moved.
 * @param {string} printerName - The name of the printer to send the job to.
 */
export const printSingleFile = async (pdfFilePath, printedFolder, printerName) => {
    try {
        // Validate the printer name
        const printers = await getPrinters();
        const selectedPrinter = printers.find((printer) => printer.name === printerName);

        if (!selectedPrinter) {
            logger.error(`Printer "${printerName}" not found.`);
            return;
        }

        // Validate the PDF file
        const fileStat = await fs.promises.stat(pdfFilePath);
        if (!fileStat.isFile() || !pdfFilePath.endsWith('.pdf')) {
            logger.error(`Invalid PDF file: ${pdfFilePath}`);
            return;
        }

        try {
            // Send the PDF to the selected printer
            await sendToPrinter(pdfFilePath, { printer: printerName });
            logger.info(`Print job for ${path.basename(pdfFilePath)} sent successfully to printer "${printerName}".`);

            // Move the file to the printed folder if specified
            if (printedFolder) {
                const printedFilePath = path.join(printedFolder, path.basename(pdfFilePath));
                await fs.promises.rename(pdfFilePath, printedFilePath);
                logger.info(`${path.basename(pdfFilePath)} has been moved to the printed folder.`);
            }
        } catch (printErr) {
            logger.error(`Error printing ${path.basename(pdfFilePath)}: ${printErr.message}`);
        }
    } catch (err) {
        logger.error(`Error: ${err.message}`);
    }
};

