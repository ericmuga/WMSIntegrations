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
import { getSerialNumber } from './serialNumberCounter.js';

import { defaultPrinter } from '../config/default.js';

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

let config
export const initPrinting = (data) => {
    // Resolve __dirname in ES module
    config = loadConfig(data);
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

    printFromFolder(pdfDirPath, printedDirPath, config.defaultPrinter);
}

const truncateWithEllipses = (text, maxWidth, doc) => {
    let ellipsis = '';
    let truncatedText = text;
    while (doc.getTextWidth(truncatedText + ellipsis) > maxWidth) {
        truncatedText = truncatedText.slice(0, -1);
    }
    return truncatedText + ellipsis;
}

const createPDF = async (data, pdfDirPath, itemNo, part, lines) => {
    const fileName = `${itemNo}_${part}.pdf`;
    const filePath = path.join(pdfDirPath, fileName);

    const doc = new jsPDF('p', 'mm', 'a4');
    // const doc = new jsPDF({
    //     orientation: 'p',
    //     unit: 'mm',
    //     format: [215, 285], // Width, Height
    // });

    doc.setFont("helvetica", "bold");

    // Pagination
    const totalPages = () => doc.getNumberOfPages();
    const addPageNumber = () => {
        const pageCount = totalPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.text(`Page ${i} of ${pageCount}`, 200, 10, { align: 'right' });
        }
    };

    const availableParts = [...new Set(data.lines.map(line => line.part))];
    const partsText = availableParts.join('|');


    const addHeaderContent = async () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        // Drawing the header at slightly offset position of x to simulate a bolder text
        doc.text(`DISPATCH Packing List ${part}        OF ${partsText}`, 105, 12, { align: 'center' });
        doc.text(`DISPATCH Packing List ${part}        OF ${partsText}`, 105 + 0.2, 12, { align: 'center' });
        doc.setFontSize(10);

        doc.text(`${config.parkingListPrefix}${data.order_no}`, 25, 30)

        doc.text(`${data.ending_date} ${data.ending_time}`, 200, 30, { align: 'right' })

        // ----------------Line----------------
        doc.text('Order Date:', 0, 38)
        if (data.shp_date)
            doc.text(data.shp_date, 42, 38)

        doc.text('Sell To Address:', 100, 38)
        if (data.shp_name)
            doc.text(data.shp_name, 140, 38)

        // ----------------Line----------------
        doc.text('Order No:', 0, 46)
        if (config.orderPrefix && data.order_no)
            doc.text(`${config.orderPrefix}${data.order_no}`, 42, 46)

        doc.text('Sales Person:', 100, 46)
        if (data.sp_code)
            doc.text(data.sp_code, 140, 46)
        doc.text('Sales Person:', 100, 46)
        if (data.sp_code)
            doc.text(data.sp_code, 140, 46)

        // ----------------Line----------------
        doc.text('Customer No:', 0, 54)
        if (data.customer_no)
            doc.text(data.customer_no, 42, 54)

        doc.text('', 100, 54)
        if (data.sp_name)
            doc.text(data.sp_name, 140, 54)
        doc.text('', 100, 54)
        if (data.sp_name)
            doc.text(data.sp_name, 140, 54)

        // ----------------Line----------------
        doc.text('Customer Name:', 0, 62)
        if (data.customer_name)
            doc.text(data.customer_name, 42, 62)

        doc.text('Delivery Date:', 100, 62)
        if (data.shp_date)
            doc.text(data.shp_date, 140, 62)
        doc.text('Delivery Date:', 100, 62)
        if (data.shp_date)
            doc.text(data.shp_date, 140, 62)

        // ----------------Line----------------
        doc.text('External DocNo:', 0, 70)
        doc.text(data.ext_doc_no, 42, 70)

        doc.text('Ship To Name:', 100, 70)
        if (data.shp_name)
            doc.text(data.shp_name, 140, 70)
        doc.text('Ship To Name:', 100, 70)
        if (data.shp_name)
            doc.text(data.shp_name, 140, 70)

        // ----------------Line----------------
        doc.text('PDA Order:', 0, 78)
        doc.text(data.pda ? 'Yes' : 'No', 42, 78)

        doc.text('Cust Ref. No:', 100, 78)
        if (data.ext_doc_no)
            doc.text(data.ext_doc_no, 140, 78)
        doc.text('Cust Ref. No:', 100, 78)
        if (data.ext_doc_no)
            doc.text(data.ext_doc_no, 140, 78)

        // ----------------Line----------------
        doc.text('Order Receiver:', 0, 86)
        if (data.ended_by)
            doc.text(data.ended_by, 42, 86)

        doc.text('External DocNo:', 100, 86)
        if (data.ext_doc_no)
            doc.text(data.ext_doc_no, 140, 86)

        // ----------------Line----------------
        doc.text('Your Ref:', 0, 94)
        if (data.your_ref)
            doc.text(data.your_ref, 42, 94)

        doc.text('District Group:', 100, 94)
        // if (data.district_group)
        doc.text(data.route_code, 140, 94)

        // ----------------Line----------------
        doc.text('Location:', 0, 102)
        if (data.location)
            doc.text(data.location, 42, 102)

        // ----------------Line----------------
        doc.text('Load To Code:', 0, 110)
        if (data.load_to_code)
            doc.text(data.load_to_code, 42, 110)

        doc.setFontSize(9);
        doc.text('Time Stamp:', 130, 102)
        doc.text(Date.now().toString(), 180, 102, { align: 'right' })

        const serial = await getSerialNumber('serial_number_counter')
            .catch(error => {
                console.error('Error fetching serial number:', error.message);

                return 'DOC-00000000'; // Fallback value
            });

        console.log(serial)

        doc.text('Serial No:', 130, 107)
        if (serial)
            doc.text(`${serial}`, 180, 107, { align: 'right' })
    }

    const addHeaderToAllPages = () => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            addHeaderContent();
        }
    };

    const tableColumnNames = [
        'Item No.', 'Description', 'Cust. Specs', 'UOM',
        'Order Qty', 'Qty \nSupplied', 'No. Of Cartons', 'Carton \nSerial No.'
    ];

    const tableData = lines.map(line => [
        line.item_no,
        line.item_description,
        line.customer_spec,
        line.unit_of_measure,
        line.order_qty,
        line.qty_supplied || '________',
        line.cartons_count || '_______',
        line.carton_serial || '________'
    ]);

    let lastTableY = 0;
    doc.autoTable({
        head: [tableColumnNames],
        body: tableData,
        startY: 115,
        startX: 2,
        margin: { left: 2, top: 115, bottom: 80, right: 2 },
        columnStyles: {
            0: { cellWidth: 25 * 0.8, fillColor: null, halign: 'left' }, // Reduce width by 20%
            1: { cellWidth: 90 * 0.8, fillColor: null, halign: 'left' }, // Reduce width by 20%
            2: { cellWidth: 25 * 0.8, fillColor: null, halign: 'left' }, // Reduce width by 20%
            3: { cellWidth: 15 * 0.8, fillColor: null, halign: 'left' }, // Reduce width by 20%
            4: { cellWidth: 25 * 0.8, fillColor: null, halign: 'left' }, // Reduce width by 20%
            5: { cellWidth: 25 * 0.8, fillColor: null, halign: 'left' }, // Reduce width by 20%
            6: { cellWidth: 20 * 0.8, fillColor: null, halign: 'left' }, // Reduce width by 20%
            7: { cellWidth: 35 * 0.8, fillColor: null, halign: 'left' }, // Reduce width by 20%
        },
        headStyles: {
            fillColor: null,
            textColor: [0, 0, 0],
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'left',
            valign: 'bottom'
        },
        didDrawCell: (data) => {
            if (data.section === 'head' && data.row.index === 0) {
                const lineY = data.cell.y + data.cell.height;
                doc.setDrawColor(0);
                doc.setLineWidth(0.3);
                doc.line(2, lineY, 200, lineY);
            }
        },
        didParseCell: (data) => {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fontSize = 9
            data.cell.styles.textColor = [0, 0, 0]
        },
        didDrawPage: (data) => {
            lastTableY = data.cursor.y;
            // const footerY = 230; // Fixed Y position for the footer

            // doc.setFontSize(10);
            // doc.text('Prepared By (Name & Sign):', 5, footerY);
            // doc.rect(5 /*X*/, footerY + 2 /*Y*/, 60 /*Width*/, 12 /*Height*/, 'S' /*'S' for stroke only*/);

            // doc.text('Packed By (Name & Sign):', 75, footerY);
            // doc.rect(75, footerY + 2, 60, 12, 'S');

            // doc.text('Checked By (Name & Sign):', 145, footerY);
            // doc.rect(145, footerY + 2, 60, 12, 'S');

            // doc.text('Total Net Weight: _____________', 75, footerY + 20);
            // doc.text('Total Gross Weight: _____________', 75, footerY + 28);
            // doc.text('Total No. Of Cartons: _____________', 75, footerY + 36);
        },
    });

    doc.setFontSize(10);

    const totalOrderQty = data.lines.reduce((sum, line) => sum + line.order_qty, 0);
    doc.text(`Total Order Quantity: ${totalOrderQty}`, 105, doc.lastAutoTable.finalY + 5, { align: 'center' });
    const addFooterOld = () => {
        const pageHeight = doc.internal.pageSize.height + 20;

        // Add a new page if necessary
        doc.setFontSize(9);
        if (lastTableY + 20 > pageHeight - 95) {
            doc.addPage();

            lastTableY = 20; // Reset to the top of the new page

            let footerY = 30
            doc.setFontSize(10);
            doc.text('Prepared By (Name & Sign):', 5, footerY);
            doc.rect(5 /*X*/, footerY + 2 /*Y*/, 60 /*Width*/, 12 /*Height*/, 'S' /*'S' for stroke only*/);

            doc.text('Packed By (Name & Sign):', 75, footerY);
            doc.rect(75, footerY + 2, 60, 12, 'S');

            doc.text('Checked By (Name & Sign):', 145, footerY);
            doc.rect(145, footerY + 2, 60, 12, 'S');

            doc.text('Total Net Weight: _____________', 75, footerY + 20);
            doc.text('Total Gross Weight: _____________', 75, footerY + 28);
            doc.text('Total No. Of Cartons: _____________', 75, footerY + 36);
        } else {
            let footerY = pageHeight - 80
            doc.setFontSize(10);
            doc.text('Prepared By (Name & Sign):', 5, footerY);
            doc.rect(5 /*X*/, footerY + 2 /*Y*/, 60 /*Width*/, 12 /*Height*/, 'S' /*'S' for stroke only*/);

            doc.text('Packed By (Name & Sign):', 75, footerY);
            doc.rect(75, footerY + 2, 60, 12, 'S');

            doc.text('Checked By (Name & Sign):', 145, footerY);
            doc.rect(145, footerY + 2, 60, 12, 'S');

            doc.text('Total Net Weight: _____________', 75, footerY + 20);
            doc.text('Total Gross Weight: _____________', 75, footerY + 28);
            doc.text('Total No. Of Cartons: _____________', 75, footerY + 36);
        }
    };

    const addFooter = () => {
        const pageCount = doc.internal.getNumberOfPages();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;

        // Loop through all pages and add the footer
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);

            const pageHeight = doc.internal.pageSize.height + 20;

            // Add a new page if necessary
            doc.setFontSize(9);
            if (lastTableY + 20 > pageHeight - 95) {
                console.log('------------Overflow: Print to new page------------')
                doc.addPage();
                lastTableY = 20; // Reset to the top of the new page

                let footerY = 30
                doc.setFontSize(10);
                doc.text('Prepared By (Name & Sign):', 5, footerY);
                doc.rect(5 /*X*/, footerY + 2 /*Y*/, 60 /*Width*/, 12 /*Height*/, 'S' /*'S' for stroke only*/);

                doc.text('Packed By (Name & Sign):', 75, footerY);
                doc.rect(75, footerY + 2, 60, 12, 'S');

                doc.text('Checked By (Name & Sign):', 145, footerY);
                doc.rect(145, footerY + 2, 60, 12, 'S');

                doc.text('Total Net Weight: _____________', 75, footerY + 20);
                doc.text('Total Gross Weight: _____________', 75, footerY + 28);
                doc.text('Total No. Of Cartons: _____________', 75, footerY + 36);
            } else {
                console.log('------------Same Page------------')
                let footerY = pageHeight - 90
                doc.setFontSize(10);
                doc.text('Prepared By (Name & Sign):', 5, footerY);
                doc.rect(5 /*X*/, footerY + 2 /*Y*/, 60 /*Width*/, 12 /*Height*/, 'S' /*'S' for stroke only*/);

                doc.text('Packed By (Name & Sign):', 75, footerY);
                doc.rect(75, footerY + 2, 60, 12, 'S');

                doc.text('Checked By (Name & Sign):', 145, footerY);
                doc.rect(145, footerY + 2, 60, 12, 'S');

                doc.text('Total Net Weight: _____________', 75, footerY + 20);
                doc.text('Total Gross Weight: _____________', 75, footerY + 28);
                doc.text('Total No. Of Cartons: _____________', 75, footerY + 36);
            }
        }
    }

    addFooter();
    addPageNumber();
    addHeaderToAllPages();

    // Save the PDF
    doc.save(filePath);
};


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

const loadConfig = (data) => {
    let config;
    if (data.sp_code === '270')
        config = companyParameter['exp']
    else
        switch (data.lines[0].item_no.substring(0, 1)) {

            case 'B': config = companyParameter['cm']; break;
            default: config = companyParameter['fcl']; break;
        }
    return config;
}

// await listPrinters();
// const sampleData = `{
//     "order_no": "BSO00031",
//     "ended_by": "AGILEBIZPAIVY.ESHIRERA",
//     "customer_no": "B25",
//     "customer_name": "Naivas Limited",
//     "shp_code": "B25_50_CM",
//     "shp_name": "NAIVAS - NEW BAMBURI",
//     "route_code": "B3535",
//     "sp_code": "B285",
//     "sp_name": "Mombasa Choice Meats",
//     "shp_date": "2024-12-20",
//     "assembler": "",
//     "checker": "",
//     "status": 4,
//     "pda": false,
//     "ending_time": "15:58:41.137",
//     "ending_date": "20240-20",
//     "ext_doc_no": "",
//     "company_flag": "Choice Meats",
//     "lines": [
//         {
//             "line_no": 10000,
//             "item_no": "BJ31015201",
//             "item_description": "Meaty Beef Sausages, 500gms",
//             "customer_spec": "",
//             "posting_group": "BF-SAUSAGE",
//             "part": "B",
//             "order_qty": 150,
//             "ass_qty": 0,
//             "exec_qty": 150,
//             "assembler": "",
//             "checker": "",
//             "barcode": "",
//             "qty_base": 150
//         },
//         {
//             "line_no": 20000,
//             "item_no": "BJ31015401",
//             "item_description": "Value Pack Beef Sausages 1kg",
//             "customer_spec": "",
//             "posting_group": "BF-SAUSAGE",
//             "part": "B",
//             "order_qty": 80,
//             "ass_qty": 0,
//             "exec_qty": 80,
//             "assembler": "",
//             "checker": "",
//             "barcode": "",
//             "qty_base": 80
//         },
//         {
//             "line_no": 30000,
//             "item_no": "BJ31015301",
//             "item_description": "Spicy Beef Sausages 500gms",
//             "customer_spec": "",
//             "posting_group": "BF-SAUSAGE",
//             "part": "B",
//             "order_qty": 0,
//             "ass_qty": 0,
//             "exec_qty": 0,
//             "assembler": "",
//             "checker": "",
//             "barcode": "",
//             "qty_base": 0
//         },
//         {
//             "line_no": 40000,
//             "item_no": "BJ31015101",
//             "item_description": "Beef Chipolatas 200gms",
//             "customer_spec": "",
//             "posting_group": "BF-SAUSAGE",
//             "part": "B",
//             "order_qty": 0,
//             "ass_qty": 0,
//             "exec_qty": 0,
//             "assembler": "",
//             "checker": "",
//             "barcode": "",
//             "qty_base": 0
//         },
//         {
//             "line_no": 50000,
//             "item_no": "BJ31100213",
//             "item_description": "Fresh Beef Burger 400gms",
//             "customer_spec": "",
//             "posting_group": "BF-FRSH BG",
//             "part": "D",
//             "order_qty": 0,
//             "ass_qty": 0,
//             "exec_qty": 0,
//             "assembler": "",
//             "checker": "",
//             "barcode": "",
//             "qty_base": 0
//         }
//     ]
// }`;

// initPrinting(JSON.parse(sampleData));