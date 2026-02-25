import xlsx from "xlsx";
import sql from "mssql";
import readline from "readline";

// Database configuration


const dbConfig = {
  user: process.env.WMS_DB_USER,
  password: process.env.WMS_DB_PASSWORD,
  server: process.env.WMS_DB_SERVER,
  database: process.env.WMS_DB_DATABASE,
  port: parseInt(process.env.WMS_DB_PORT || "1433"),
  options: {
    encrypt: process.env.WMS_DB_ENCRYPT === "true",
    trustServerCertificate: process.env.WMS_DB_TRUST_CERT === "true",
    enableArithAbort: true,
  },
};

// helpers
function ensureString(value) {
  if (value === null || value === undefined) return "";
  return typeof value === "number" ? value.toString() : String(value);
}
function ensureNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function prefixFromRecipe(recipe) {
  const r = ensureString(recipe).trim();
  const recipeGroup = r.substring(0, 4);
  const prefixMap = { "1210": "1", "1220": "2", "1230": "3", "1240": "4" };
  return prefixMap[recipeGroup] || "0";
}

// shortcode = <1/2/3/4><recipe suffix><item first letter><item digits>
function buildShortcode(recipe, itemCode) {
  recipe = ensureString(recipe).trim();
  itemCode = ensureString(itemCode).trim();
  if (!recipe || !itemCode) return "";

  const recipePrefix = prefixFromRecipe(recipe);
  const recipeSuffix = recipe.substring(4);

  const itemPrefix = itemCode.substring(0, 1).toUpperCase();
  const itemDigits = itemCode.replace(/\D/g, "");

  return `${recipePrefix}${recipeSuffix}${itemPrefix}${itemDigits}`;
}

function loadExcel(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
  return data;
}

function getDistinctRecipes(rows) {
  const set = new Set(
    rows
      .map((r) => ensureString(r.recipe).trim())
      .filter((v) => v.length > 0)
  );
  return Array.from(set).sort();
}

async function pickFromList(options) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  console.log("\nAvailable recipes (distinct):");
  options.forEach((r, i) => console.log(`${i + 1}. ${r}`));

  const answer = await ask("\nChoose a number (or type exact recipe): ");
  rl.close();

  const raw = ensureString(answer).trim();
  const idx = Number(raw);

  if (Number.isFinite(idx) && idx >= 1 && idx <= options.length) return options[idx - 1];

  // allow typing exact recipe code
  const match = options.find((r) => r === raw);
  if (!match) throw new Error(`Invalid selection: ${raw}`);
  return match;
}

// Function to process the Excel file and insert data
async function processAndInsertData(filePath, templateNoFilter) {
  try {
    // Read Excel
    const data = loadExcel(filePath);

    console.log(`Loaded ${data.length} rows from Excel.`);
    if (data.length > 0) console.log("Detected columns:", Object.keys(data[0]));

    const recipe = ensureString(templateNoFilter).trim();

    // Filter by recipe (template_no)
    const filtered = data.filter((r) => ensureString(r.recipe).trim() === recipe);
    console.log(`Filtered rows for recipe/template_no=${recipe}: ${filtered.length}`);

    if (filtered.length === 0) {
      console.log("No rows match the recipe filter. Exiting.");
      return;
    }

    // Validate required columns exist
    const cols = Object.keys(filtered[0] || {});
    const required = [
      "recipe",
      "output_item",
      "output_item_dec",
      "output_item_uom",
      "batch_size",
      "output_item_location",
      "input_item",
      "input_item_desc",
      "input_item_uom",
      "input_item_qt_per",
      "input_item_location",
    ];
    const missing = required.filter((c) => !cols.includes(c));
    if (missing.length) {
      console.error("❌ Missing required columns in Excel:", missing);
      return;
    }

    const pool = await sql.connect(dbConfig);
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // Delete ONCE at the beginning
      await new sql.Request(tx)
        .input("template_no", sql.NVarChar, recipe)
        .query(`
          DELETE FROM [calibra].[dbo].[template_lines]
          WHERE [template_no] = @template_no;
        `);

      console.log(`Deleted existing lines for template_no=${recipe}`);

      // Output row source (from output columns)
      const firstWithOutput =
        filtered.find((r) => ensureString(r.output_item).trim() !== "") || filtered[0];

      const output_item = ensureString(firstWithOutput.output_item).trim();
      const output_item_dec = ensureString(firstWithOutput.output_item_dec).trim();
      const output_item_uom = ensureString(firstWithOutput.output_item_uom).trim();
      const output_item_location = ensureString(firstWithOutput.output_item_location).trim();
      const batch_size = ensureNumber(firstWithOutput.batch_size) ?? 84.465;

      if (!batch_size || batch_size <= 0) {
        throw new Error(`Invalid batch_size for recipe ${recipe}.`);
      }

      const insertQuery = `
        INSERT INTO [calibra].[dbo].[template_lines] (
          [template_no],
          [item_code],
          [description],
          [percentage],
          [units_per_100],
          [type],
          [main_product],
          [shortcode],
          [unit_measure],
          [location],
          [created_at],
          [updated_at]
        )
        VALUES (
          @template_no,
          @item_code,
          @description,
          @percentage,
          @units_per_100,
          @type,
          @main_product,
          @shortcode,
          @unit_measure,
          @location,
          GETDATE(),
          GETDATE()
        );
      `;

      // Insert INTAKE rows
      let intakeInserted = 0;

      for (const row of filtered) {
        const input_item = ensureString(row.input_item).trim();
        const input_item_desc = ensureString(row.input_item_desc).trim();
        const input_item_uom = ensureString(row.input_item_uom).trim();
        const input_item_qt_per = ensureNumber(row.input_item_qt_per);
        const input_item_location = ensureString(row.input_item_location).trim();

        if (!input_item || !input_item_desc || input_item_qt_per === null) continue;

        const percentage = (input_item_qt_per / batch_size) * 100;
        const unitsPer100 = percentage;

        await new sql.Request(tx)
          .input("template_no", sql.NVarChar, recipe)
          .input("item_code", sql.NVarChar, input_item)
          .input("description", sql.NVarChar, input_item_desc)
          .input("percentage", sql.Decimal(18, 9), percentage)
          .input("units_per_100", sql.Decimal(18, 9), unitsPer100)
          .input("type", sql.NVarChar, "Intake")
          .input("main_product", sql.Bit, 0)
          .input("shortcode", sql.NVarChar, buildShortcode(recipe, input_item))
          .input("unit_measure", sql.NVarChar, input_item_uom || "KG")
          .input("location", sql.NVarChar, input_item_location || "2055")
          .query(insertQuery);

        intakeInserted++;
      }

      console.log(`Inserted intake lines: ${intakeInserted}`);

      // Insert ONE output line at bottom
      if (output_item) {
        await new sql.Request(tx)
          .input("template_no", sql.NVarChar, recipe)
          .input("item_code", sql.NVarChar, output_item)
          .input("description", sql.NVarChar, output_item_dec || output_item)
          .input("percentage", sql.Decimal(18, 9), 100)
          .input("units_per_100", sql.Decimal(18, 9), 100)
          .input("type", sql.NVarChar, "Output")
          .input("main_product", sql.Bit, 1)
          .input("shortcode", sql.NVarChar, buildShortcode(recipe, output_item))
          .input("unit_measure", sql.NVarChar, output_item_uom || "KG")
          .input("location", sql.NVarChar, output_item_location || "2055")
          .query(insertQuery);

        console.log(`Inserted Output line: ${recipe} | ${output_item}`);
      }

      await tx.commit();
      console.log(`✅ Done. Replaced template_lines for template_no=${recipe}`);

      pool.close();
    } catch (err) {
      await tx.rollback();
      pool.close();
      console.error("❌ Transaction rolled back:", err);
    }
  } catch (error) {
    console.error("Error processing data:", error);
  }
}

// ---- main ----
const filePath = "D:\\code\\WMSIntegrations\\Services\\Utils\\Chp.xlsx";

const rows = loadExcel(filePath);
const recipes = getDistinctRecipes(rows);

if (recipes.length === 0) {
  console.log("No recipes found in the 'recipe' column.");
  process.exit(0);
}

const selectedRecipe = await pickFromList(recipes);
console.log("Selected recipe:", selectedRecipe);

await processAndInsertData(filePath, selectedRecipe);
