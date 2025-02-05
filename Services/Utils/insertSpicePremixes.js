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

// Function to process the Excel file and insert data
async function processAndInsertData(filePath) {
  try {
    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`Loaded ${data.length} rows from Excel.`);

    // Connect to the database
    const pool = await sql.connect(dbConfig);
    function ensureString(value) {
    if (value === null || value === undefined) return ""; // Treat null/undefined as empty string
    return typeof value === "number" ? value.toString() : value; // Convert number to string
    }


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
      } = row;

      // Skip rows where `recipe` is blank
      if (!recipe || recipe.trim() === "") {
        console.log(`Skipping row with blank recipe: ${JSON.stringify(row)}`);
        continue;
      }

      // Set default value for missing fields if needed
      const sanitizedProcess = ensureString(Process);
      const sanitizedRecipe = ensureString(recipe);
      const sanitizedOutputItem = ensureString(output_item);
      const sanitizedOutputLocationCode = ensureString(output_item_location);
      const sanitizedInputItemCode = ensureString(input_item);
      const sanitizedInputLocationCode = ensureString(input_item_location);


      // Insert the row only if it doesn't exist
      const query = `
        IF NOT EXISTS (
          SELECT 1 FROM [calibra].[dbo].[RecipeData]
          WHERE [recipe] = @recipe AND [input_item] = @input_item AND [output_item] = @output_item
        )
        INSERT INTO [calibra].[dbo].[RecipeData] (
          [Process],
          [output_item],
          [recipe],
          [output_item_dec],
          [output_item_uom],
          [batch_size],
          [output_item_location],
          [input_item],
          [input_item_desc],
          [input_item_uom],
          [input_item_qt_per],
          [input_item_location]
        )
        VALUES (
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
          @input_item_location
        );
      `;

      await pool.request()
        .input("Process", sql.NVarChar, sanitizedProcess)
        .input("recipe", sql.NVarChar, sanitizedRecipe)
        .input("output_item", sql.NVarChar, sanitizedOutputItem)
        .input("output_item_dec", sql.NVarChar, output_item_dec)
        .input("output_item_uom", sql.NVarChar, output_item_uom)
        .input("batch_size", sql.Decimal(10, 2), batch_size)
        .input("output_item_location", sql.NVarChar, sanitizedOutputLocationCode)
        .input("input_item", sql.NVarChar, sanitizedInputItemCode)
        .input("input_item_desc", sql.NVarChar, input_item_desc)
        .input("input_item_uom", sql.NVarChar, input_item_uom)
        .input("input_item_qt_per", sql.Decimal(10, 4), input_item_qt_per)
        .input("input_item_location", sql.NVarChar, sanitizedInputLocationCode)
        .query(query);


      console.log(`Processed recipe: ${recipe}, input item: ${input_item}`);
    }

    console.log("Data processing completed.");
    pool.close();
  } catch (error) {
    console.error("Error processing data:", error);
  }
}
// Example usage
const filePath = "C:\\code\\WMSIntegrations\\Services\\Utils\\mIN.xlsx";
console.log("File path:", filePath);
processAndInsertData(filePath);