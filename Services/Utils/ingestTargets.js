// const date = new Date(r.MonthDate); // e.g. 2026-02-01
// const monthNameSorted =
//   `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthNameSorted = '2026-02';



// npm i mssql xlsx
import xlsx from "xlsx";
import sql from "mssql";

const dbConfig = {
  user: "reporter",
  password: "p3u!~XuEdx?u2kK",
  server: "172.16.10.9",
  database: "FCLWHS",
  options: { encrypt: false, enableArithAbort: true },
};// delete existing month




  const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then(pool => {
    console.log("Connected to SQL Server");
    return pool;
  })
  .catch(err => {
    console.error("Database connection failed: ", err.message);
    throw err;
  });
const pool = await poolPromise;

const wb = xlsx.readFile('D:/FEBTARGETS.xlsx');
const sheet = wb.SheetNames[0];
const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheet], { defval: null });



await pool.request()
  .input('MonthNameSorted', sql.Char(7), monthNameSorted)
  .query(`
    DELETE FROM [FCLWHS].[dbo].[FACT_WEEKLYTARGETS]
    WHERE MonthNameSorted = @MonthNameSorted
  `);
// insert

for (const r of rows) {
  await pool.request()
    .input('CustomerNo', sql.VarChar, r.CustomerNo)
    .input('ShipToCode', sql.VarChar, r.ShipToCode)
    .input('ItemNo', sql.VarChar, r.ItemNo)
    .input('VolTargetKgs', sql.Decimal(18, 2), r.VolTargetKgs)
    .input('ValTarget', sql.Decimal(18, 2), r.ValTarget)
    .input('Company', sql.VarChar, r.Company)
    .input('Outlet', sql.VarChar, r.Outlet)
    .input('MonthNameSorted', sql.Char(7), monthNameSorted)
    .query(`
      INSERT INTO [FCLWHS].[dbo].[FACT_WEEKLYTARGETS]
      (
        CustomerNo,
        ShipToCode,
        ItemNo,
        VolTargetKgs,
        ValTarget,
        Company,
        Outlet,
        MonthNameSorted
      )
      VALUES
      (
        @CustomerNo,
        @ShipToCode,
        @ItemNo,
        @VolTargetKgs,
        @ValTarget,
        @Company,
        @Outlet,
        @MonthNameSorted
      )
    `);
}
