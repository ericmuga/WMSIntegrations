import xlsx from "xlsx";
import sql from "mssql";

import dotenv from "dotenv";
dotenv.config();

// Database configuration


const dbConfig = {
  user: process.env.WHS_DB_USER,
  password: process.env.WHS_DB_PASSWORD,
  server: process.env.WHS_DB_SERVER,
  database: process.env.WHS_DB_DATABASE,
  port: parseInt(process.env.WHS_DB_PORT || "1433"),
  options: {
    encrypt: process.env.WHS_DB_ENCRYPT === "true",
    trustServerCertificate: process.env.WHS_DB_TRUST_CERT === "true",
    enableArithAbort: true,
  },
};

// Helpers
function ensureString(value) {
  if (value === null || value === undefined) return "";
  return typeof value === "number" ? value.toString() : String(value).trim();
}

function ensureNumber(value) {
  if (value === null || value === undefined) return 0;

  // Convert to string
  let str = String(value).trim();

  if (str === "") return 0;

  // Remove commas (12,500 → 12500)
  str = str.replace(/,/g, "");

  const num = Number(str);
  return Number.isFinite(num) ? num : 0;
}

// Main import function
async function processAndInsertWeeklyTargets(filePath) {
  const MONTH_NAME_SORTED = "2026-02";
  const watermarkLoadedAt = new Date();

  let pool;

  try {
    // Read Excel
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: "",
    });

    console.log(`Loaded ${data.length} rows from Excel: ${sheetName}`);

    // Connect DB
    pool = await sql.connect(dbConfig);

    // Upsert query
    const upsertQuery = `
      IF EXISTS (
        SELECT 1
        FROM [FCLWHS].[dbo].[FACT_WEEKLYTARGETS]
        WHERE
          [CustomerNo] = @CustomerNo
          AND [ShipToCode] = @ShipToCode
          AND [ItemNo] = @ItemNo
          AND [Company] = @Company
          AND [MonthNameSorted] = @MonthNameSorted
      )
      BEGIN
        UPDATE [FCLWHS].[dbo].[FACT_WEEKLYTARGETS]
        SET
          [VolTargetKgs] = @VolTargetKgs,
          [ValTarget] = @ValTarget,
          [Outlet] = @Outlet,
          [WatermarkLoadedAt] = @WatermarkLoadedAt
        WHERE
          [CustomerNo] = @CustomerNo
          AND [ShipToCode] = @ShipToCode
          AND [ItemNo] = @ItemNo
          AND [Company] = @Company
          AND [MonthNameSorted] = @MonthNameSorted;
      END
      ELSE
      BEGIN
        INSERT INTO [FCLWHS].[dbo].[FACT_WEEKLYTARGETS] (
          [CustomerNo],
          [ShipToCode],
          [ItemNo],
          [VolTargetKgs],
          [ValTarget],
          [Company],
          [Outlet],
          [MonthNameSorted],
          [WatermarkLoadedAt]
        )
        VALUES (
          @CustomerNo,
          @ShipToCode,
          @ItemNo,
          @VolTargetKgs,
          @ValTarget,
          @Company,
          @Outlet,
          @MonthNameSorted,
          @WatermarkLoadedAt
        );
      END
    `;

    let processed = 0;
    let skipped = 0;

    for (const row of data) {
      // Columns from your Excel
      const customerNo = ensureString(row["n"]);
      const shipToCode = ensureString(row["ShiptoCode"]);
      const company = ensureString(row["Company"]);
      const itemNo = ensureString(row["No."]);

      const volTarget = ensureNumber(row["FinalFebWeeklyVolTarget"]);
      const valTarget = ensureNumber(row["FinalFebWeeklyValTarget(Kshs)"]);

      // Skip bad rows
      if (!customerNo || !shipToCode || !company || !itemNo) {
        skipped++;
        continue;
      }

      const outlet = `${customerNo}_${shipToCode}_${company}`;

      await pool
        .request()
        .input("CustomerNo", sql.NVarChar, customerNo)
        .input("ShipToCode", sql.NVarChar, shipToCode)
        .input("ItemNo", sql.NVarChar, itemNo)
        .input("VolTargetKgs", sql.Decimal(18, 6), volTarget)
        .input("ValTarget", sql.Decimal(18, 6), valTarget)
        .input("Company", sql.NVarChar, company)
        .input("Outlet", sql.NVarChar, outlet)
        .input("MonthNameSorted", sql.NVarChar, MONTH_NAME_SORTED)
        .input("WatermarkLoadedAt", sql.DateTime2, watermarkLoadedAt)
        .query(upsertQuery);

      processed++;
      if (processed % 200 === 0) console.log(`Processed ${processed} rows...`);
    }

    console.log(`Done. Processed: ${processed}, Skipped: ${skipped}`);
  } catch (error) {
    console.error("Error processing data:", error);
  } finally {
    if (pool) await pool.close();
  }
}

// Example usage
const filePath = "D:\\code\\WMSIntegrations\\Services\\Utils\\Targets.xlsx";//"; // change to your file path
console.log("File path:", filePath);
processAndInsertWeeklyTargets(filePath);