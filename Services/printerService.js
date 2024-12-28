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
// import { getCompanyConfig } from './companyConfig.js';

import { defaultPrinter } from '../config/default.js';
// import { config } from 'process';
// import { config } from 'process';

// export const defaultPrinter = 'Microsoft Print to PDF (redirected 2)';

// export const defaultPrinter = 'HP0F5A0C (HP LaserJet Pro M404-M405)';

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
    console.log('data',data)
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

    // logger.info('PDFs generated successfully.');
    // logger.info('config',loadConfig(data))
    printFromFolder(pdfDirPath, printedDirPath, config.defaultPrinter);
}

const createPDF = async (data, pdfDirPath, itemNo, part, lines) => {
    const fileName = `${itemNo}_${part}.pdf`;
    const filePath = path.join(pdfDirPath, fileName);

    // const doc = new jsPDF('p', 'mm', 'a4'); // A4 size page
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [215, 285], // Width: 215mm, Height: 285mm
    });

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
            doc.text(`Page ${i} of ${pageCount}`, 200, 8.5, { align: 'right' });
        }
    };
    
    const availableParts = [...new Set(data.lines.map(line => line.part))];
    const partsText = availableParts.join('|');

    // const config = getCompanyConfig(data.company_flag.toLowerCase())

    //temporatily using fcl before the company flag is added to the data
    // const config = getCompanyConfig(`fcl`)
    // let  config;// = companyParameter['fcl'];

    //switch between company printers
   
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    // Drawing the header at slightly offset position of x to simulate a bolder text
    doc.text(`DISPATCH Packing List ${part}        OF ${partsText}`, 105, 10, { align: 'center' });
    doc.text(`DISPATCH Packing List ${part}        OF ${partsText}`, 105 + 0.2, 10, { align: 'center' });
    doc.setFontSize(14);

    doc.text(`${config.parkingListPrefix}${data.order_no}`, 15, 30)

    doc.text(`${data.ending_date} ${data.ending_time}`, 230, 30, { align: 'right' })

    // ----------------Line----------------
    doc.text('Order Date:', -12, 38)
    doc.text(data.shp_date, 42, 38)

    doc.text('Sell To Address:', 120, 38)
    doc.text(data.shp_name, 170, 38)

    // ----------------Line----------------
    doc.text('Order No:', -12, 46)
    doc.text(`${config.orderPrefix}${data.order_no}`, 42, 46)

    doc.text('Sales Person:', 120, 46)
    doc.text(data.sp_code, 170, 46)

    // ----------------Line----------------
    doc.text('Customer No:', -12, 54)
    doc.text(data.customer_no, 42, 54)

    doc.text('', 120, 54)
    doc.text(data.sp_name, 170, 54)

    // ----------------Line----------------
    doc.text('Customer Name:', -12, 62)
    doc.text(data.customer_name, 42, 62)

    doc.text('Delivery Date:', 120, 62)
    doc.text(data.shp_date, 170, 62)

    // ----------------Line----------------
    doc.text('External DocNo:', -12, 70)
    doc.text(data.ext_doc_no, 42, 70)

    doc.text('Ship To Name:', 120, 70)
    doc.text(data.shp_name, 170, 70)

    // ----------------Line----------------
    doc.text('PDA Order:', -12, 78)
    doc.text(data.pda ? 'Yes' : 'No', 42, 78)

    doc.text('Cust Ref. No:', 120, 78)
    doc.text(data.ext_doc_no, 170, 78)

    // ----------------Line----------------
    doc.text('Order Receiver:', -12, 86)
    doc.text(data.ended_by, 42, 86)

    doc.text('External DocNo:', 120, 86)
    doc.text(data.ext_doc_no, 170, 86)

    // ----------------Line----------------
    doc.text('Your Ref:', -12, 94)
    doc.text('', 42, 94)

    doc.text('District Group:', 120, 94)
    doc.text('', 170, 94)

    // ----------------Line----------------
    doc.text('Location:', -12, 102)
    doc.text(data.route_code, 42, 102)

    doc.setFontSize(12);
    doc.text('Time Stamp:', 182, 102)
    doc.text(Date.now().toString(), 240, 102, { align: 'right' })

    const serial = await getSerialNumber('serial_number_counter')
        .catch(error => {
            console.error('Error fetching serial number:', error.message);

            return 'DOC-00000000'; // Fallback value
        });

    console.log(serial)

    doc.text('Serial No:', 185, 107)
    doc.text(`${serial}`, 240, 107, { align: 'right' })

    doc.setFontSize(14);

    const tableColumnNames = [
        'Item No.', 'Description', 'Cust. Specs', 'Unit of \nMeasure',
        'Order Qty', 'QTY \nSupplied', 'No. Of Cartons', 'Carton \nSerial No.'
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
        startX: 2,
        margin: { left: 2, top: 30, bottom: 80 },
        columnStyles: {
            0: { cellWidth: 40, fillColor: null, halign: 'left' },
            1: { cellWidth: 65, fillColor: null, halign: 'left' },
            2: { cellWidth: 20, fillColor: null, halign: 'left' },
            3: { cellWidth: 30, fillColor: null, halign: 'left' },
            4: { cellWidth: 15, fillColor: null, halign: 'left' },
            5: { cellWidth: 25, fillColor: null, halign: 'left' },
            6: { cellWidth: 20, fillColor: null, halign: 'left' },
            7: { cellWidth: 35, fillColor: null, halign: 'left' },
        },
        headStyles: {
            fillColor: null,
            textColor: [0, 0, 0],
            fontSize: 12,
            fontStyle: 'bold',
            halign: 'left',
            valign: 'bottom'
        },
        didDrawCell: (data) => {
            if (data.section === 'head' && data.row.index === 0) {
                const lineY = data.cell.y + data.cell.height;
                doc.setDrawColor(0);
                doc.setLineWidth(0.5);
                doc.line(2, lineY, 245, lineY);
            }
        },
        didParseCell: (data) => {
            // if (data.section === 'body' && data.column.index === 0) {
                data.cell.styles.fontStyle = 'bold'
                data.cell.styles.fontSize = 12
            // }

            data.cell.styles.textColor = [0, 0, 0]
        },
        didDrawPage: (data) => {
            const footerY = 240; // Fixed Y position for the footer

            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text('Prepared By (Name & Sign):', 5, footerY);
            doc.rect(5 /*X*/, footerY + 2 /*Y*/, 60 /*Width*/, 12 /*Height*/, 'S' /*'S' for stroke only*/);

            doc.text('Packed By (Name & Sign):', 75, footerY);
            doc.rect(75, footerY + 2, 60, 12, 'S');

            doc.text('Checked By (Name & Sign):', 145, footerY);
            doc.rect(145, footerY + 2, 60, 12, 'S');

            doc.text('Total Net Weight: ___________', 75, footerY + 24);
            doc.text('Total Gross Weight: ___________', 75, footerY + 32);
            doc.text('Total No. Of Cartons: ___________', 75, footerY + 40);
        },
    });

    doc.setFont("helvetica", "bold");
    doc.text(`Total Order Quantity: ${lines.length}`, 105, doc.lastAutoTable.finalY + 10, { align: 'center' });

    addPageNumber();

    // Save the PDF
    doc.save(filePath);
};

// const getCompanyConfig = (flag) => {
//     let config
//     if (!flag)
//        config = companyParameter['fcl'];

//     config = companyParameter[flag];

//     return config;
// }


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



const loadConfig = (data) => { 
   let config;
    if (data.sp_code==='270')
        config = companyParameter['exp']
    else
        switch (data.lines[0].item_no.substring(0, 1)) {
        
            case 'B': config = companyParameter['cm']; break;
            default :config = companyParameter['fcl']; break;
        }
        return config;
   }




await listPrinters();
// const sampleData=`{
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
//     "ending_date": "2024-12-20",
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