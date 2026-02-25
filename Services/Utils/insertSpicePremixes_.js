import xlsx from "xlsx";
import sql from "mssql";

// Database configuration
const dbConfig = {
  user: "reporter",
  password: "p3u!~XuEdx?u2kK",
  server: "fcl-wms", // e.g., localhost
  database: "calibra",
  options: {
    encrypt: false, // Set to true if using Azure
    enableArithAbort: true,
  },
};

// Helper to ensure values are strings where needed
function ensureString(value) {
  if (value === null || value === undefined) return ""; // Treat null/undefined as empty string
  return typeof value === "number" ? value.toString() : value; // Convert number to string
}

// Function to process the Excel file and upsert data
async function processAndInsertData(filePath) {
  let pool;

  try {
    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`Loaded ${data.length} rows from Excel.`);

    // Connect to the database
    pool = await sql.connect(dbConfig);

    // Loop through each row
    for (const row of data) {
      const {
        Process,
        recipe,
        output_item,
        output_item_dec,
        output_item_uom,
        batch_size,
        output_item_location,
        input_item,
        input_item_desc,
        input_item_uom,
        input_item_qt_per,
        input_item_location,
        process_code,
        no_series,
        routing,
      } = row;

      // Skip rows where `recipe` is blank
      if (!recipe || recipe.toString().trim() === "") {
        console.log(`Skipping row with blank recipe: ${JSON.stringify(row)}`);
        continue;
      }

      // Sanitize / normalize string fields
      const sanitizedProcess = ensureString(Process);
      const sanitizedRecipe = ensureString(recipe);
      const sanitizedOutputItem = ensureString(output_item);
      const sanitizedOutputLocationCode = ensureString(output_item_location);
      const sanitizedInputItemCode = ensureString(input_item);
      const sanitizedInputLocationCode = ensureString(input_item_location);
      const sanitizedProcessCode = ensureString(process_code);
      const sanitizedNoSeries = ensureString(no_series);
      const sanitizedRouting = ensureString(routing);

      // MERGE: update if exists, insert if not
      const query = `
        MERGE [calibra].[dbo].[RecipeData] AS target
        USING (VALUES (
          @process,
          @output_item,
          @recipe,
          @output_item_dec,
          @output_item_uom,
          @batch_size,
          @output_item_location,
          @input_item,
          @input_item_desc,
          @input_item_uom,
          @input_item_qt_per,
          @input_item_location,
          @process_code,
          @no_series,
          @routing
        )) AS source (
          Process,
          output_item,
          recipe,
          output_item_dec,
          output_item_uom,
          batch_size,
          output_item_location,
          input_item,
          input_item_desc,
          input_item_uom,
          input_item_qt_per,
          input_item_location,
          process_code,
          no_series,
          routing
        )
        ON  target.recipe      = source.recipe
        AND target.input_item  = source.input_item
        AND target.output_item = source.output_item

        WHEN MATCHED THEN
          UPDATE SET
            target.Process             = source.Process,
            target.output_item_dec     = source.output_item_dec,
            target.output_item_uom     = source.output_item_uom,
            target.batch_size          = source.batch_size,
            target.output_item_location= source.output_item_location,
            target.input_item_desc     = source.input_item_desc,
            target.input_item_uom      = source.input_item_uom,
            target.input_item_qt_per   = source.input_item_qt_per,
            target.input_item_location = source.input_item_location,
            target.process_code        = source.process_code,
            target.no_series           = source.no_series,
            target.routing             = source.routing

        WHEN NOT MATCHED THEN
          INSERT (
            Process,
            output_item,
            recipe,
            output_item_dec,
            output_item_uom,
            batch_size,
            output_item_location,
            input_item,
            input_item_desc,
            input_item_uom,
            input_item_qt_per,
            input_item_location,
            process_code,
            no_series,
            routing
          )
          VALUES (
            source.Process,
            source.output_item,
            source.recipe,
            source.output_item_dec,
            source.output_item_uom,
            source.batch_size,
            source.output_item_location,
            source.input_item,
            source.input_item_desc,
            source.input_item_uom,
            source.input_item_qt_per,
            source.input_item_location,
            source.process_code,
            source.no_series,
            source.routing
          );
      `;

      await pool
        .request()
        .input("process", sql.NVarChar, sanitizedProcess)
        .input("output_item", sql.NVarChar, sanitizedOutputItem)
        .input("recipe", sql.NVarChar, sanitizedRecipe)
        .input("output_item_dec", sql.NVarChar, output_item_dec)
        .input("output_item_uom", sql.NVarChar, output_item_uom)
        .input("batch_size", sql.Decimal(10, 2), batch_size)
        .input("output_item_location", sql.NVarChar, sanitizedOutputLocationCode)
        .input("input_item", sql.NVarChar, sanitizedInputItemCode)
        .input("input_item_desc", sql.NVarChar, input_item_desc)
        .input("input_item_uom", sql.NVarChar, input_item_uom)
        .input("input_item_qt_per", sql.Decimal(10, 4), input_item_qt_per)
        .input("input_item_location", sql.NVarChar, sanitizedInputLocationCode)
        .input("process_code", sql.NVarChar, sanitizedProcessCode)
        .input("no_series", sql.NVarChar, sanitizedNoSeries)
        .input("routing", sql.NVarChar, sanitizedRouting)
        .query(query);

      console.log(`Upserted recipe: ${sanitizedRecipe}, input item: ${sanitizedInputItemCode}`);
    }

    console.log("Data processing completed.");
  } catch (error) {
    console.error("Error processing data:", error);
  } finally {
    if (pool) {
      await pool.close();
    }
    // Close global connection state for mssql
    sql.close && sql.close();
  }
}

// Example usage
const filePath = "D:\\code\\WMSIntegrations\\Services\\Utils\\INS.xlsx";
console.log("File path:", filePath);
processAndInsertData(filePath);
