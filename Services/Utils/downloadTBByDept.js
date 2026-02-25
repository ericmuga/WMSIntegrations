import express from 'express';
import sql from 'mssql';
import xl from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

// Database configuration
const config = {
    user: 'reporter',
    password: 'p3u!~XuEdx?u2kK',
    server: '172.16.10.8',
    database: 'FCL',
    options: {
        encrypt: false, // Set to true if using Azure
        trustServerCertificate: true, // Set to true if using self-signed cert
    },
};

// Query function
const getData = async (startDate, endDate) => {
    try {
        await sql.connect(config);
        const query = `
            SELECT v.[G_L Account No_], v.[Account Name], v.Dept, SUM(v.Amount) [Amount]
            FROM (
                SELECT J.[G_L Account No_], J.[Name] AS [Account Name],
                CASE 
                    WHEN J.[Dept Code] >= '1100' AND J.[Dept Code] <= '1102' THEN '1100-Pig Procurement'
                    WHEN J.[Dept Code] >= '1220' AND J.[Dept Code] <= '1222' THEN '1220-Butchery'
                    WHEN J.[Dept Code] >= '1230' AND J.[Dept Code] <= '1232' THEN '1230-Sausage'
                    WHEN J.[Dept Code] >= '1700' AND J.[Dept Code] <= '1790' THEN '1700-SECURITY'
                    WHEN J.[Dept Code] >= '1800' AND J.[Dept Code] <= '1830' THEN '1800-GENERAL'
                    WHEN J.[Dept Code] >= '2200' AND J.[Dept Code] <= '2202' THEN '2200-DISPATCH'
                    WHEN J.[Dept Code] >= '3600' AND J.[Dept Code] <= '3610' THEN '3600-MARKETING'
                    WHEN J.[Dept Code] >= '3900' AND J.[Dept Code] <= '3910' THEN '3900-DISTRIBUTION'
                    WHEN J.[Dept Code] >= '4000' AND J.[Dept Code] <= '4050' THEN '4050-TRANSPORT TOTAL'
                    WHEN J.[Dept Code] >= '5100' AND J.[Dept Code] <= '5240' THEN '5100-Administration'
                    ELSE 'Blank'
                END AS [Dept],
                SUM(J.Amount) [Amount]
                FROM (
                    SELECT a.[G_L Account No_], b.[Name],
                    CASE WHEN a.[Global Dimension 1 Code] = '' THEN 'BLANK' ELSE a.[Global Dimension 1 Code] END AS [Dept Code],
                    SUM(a.[Amount]) [Amount]
                    FROM [FCL1$G_L Entry$437dbf0e-84ff-417a-965d-ed2bb9650972] AS a
                    INNER JOIN [FCL1$G_L Account$437dbf0e-84ff-417a-965d-ed2bb9650972] AS b ON a.[G_L Account No_] = b.[No_]
                    WHERE LEFT(a.[G_L Account No_], 1) IN ('6', '7')
                    AND a.[Posting Date] >= @startDate AND a.[Posting Date] <= @endDate
                    GROUP BY a.[G_L Account No_], a.[Global Dimension 1 Code], b.[Name]
                ) AS J
                GROUP BY J.[G_L Account No_], J.[Name], J.[Dept Code]
            ) AS v
            GROUP BY v.[G_L Account No_], v.[Account Name], v.Dept
            ORDER BY v.[Dept]
        `;
        const result = await sql.query(query.replace('@startDate', `'${startDate}'`).replace('@endDate', `'${endDate}'`));
        return result.recordset;
    } catch (err) {
        console.error(err);
        throw err;
    } finally {
        await sql.close();
    }
};

// Generate Excel file
const generateExcel = (data, filePath) => {
    const wb = xl.utils.book_new();
    const ws = xl.utils.json_to_sheet(data);
    xl.utils.book_append_sheet(wb, ws, 'Summary');
    
    const groupedData = data.reduce((acc, row) => {
        if (!acc[row.Dept]) acc[row.Dept] = [];
        acc[row.Dept].push(row);
        return acc;
    }, {});
    
    Object.keys(groupedData).forEach(dept => {
        const wsDept = xl.utils.json_to_sheet(groupedData[dept]);
        xl.utils.book_append_sheet(wb, wsDept, dept);
        
        // Adding total row
        const totalAmount = groupedData[dept].reduce((sum, row) => sum + row.Amount, 0);
        xl.utils.sheet_add_aoa(wsDept, [["Total", "", "", totalAmount]], { origin: -1 });
    });
    
    xl.writeFile(wb, filePath);
};

// API endpoint to download the Excel file
app.get('/download', async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
        return res.status(400).send('startDate and endDate are required.');
    }

    try {
        const data = await getData(startDate, endDate);
        const filePath = path.join(__dirname, 'data.xlsx');
        generateExcel(data, filePath);

        res.download(filePath, 'data.xlsx', (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(500).send('Error downloading file.');
            }
            fs.unlinkSync(filePath); // Delete file after sending
        });
    } catch (err) {
        res.status(500).send('Error generating report.');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
