// insertChoppingRecipes.js
// npm i mssql xlsx
import xlsx from "xlsx";
import sql from "mssql";

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

function ensureString(v) {
  if (v === null || v === undefined) return "";
  return typeof v === "number" ? v.toString() : String(v);
}
function ensureNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function normalizeRowKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const nk = String(k)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^\w]/g, "_")
      .replace(/_+/g, "_");
    out[nk] = v;
  }
  return out;
}
function makeShortcode(prefix, item) {
  const clean = ensureString(item).trim().replace(/\s+/g, "").slice(0, 40);
  return `${prefix}-${clean || "UNKNOWN"}`;
}

async function run(filePath) {
  let pool;

  try {
    const wb = xlsx.readFile(filePath);
    const sheet = wb.SheetNames[0];
    const rawRows = xlsx.utils.sheet_to_json(wb.Sheets[sheet], { defval: null });

    if (!rawRows.length) {
      console.log("No rows found in Excel.");
      return;
    }

    const rows = rawRows.map(normalizeRowKeys);

    console.log("Detected Excel headers:", Object.keys(rows[0]));

    // Group by recipe (template_no)
    const byRecipe = new Map();
    for (const r of rows) {
      const recipe = ensureString(r.recipe).trim();
      if (!recipe) continue;
      if (!byRecipe.has(recipe)) byRecipe.set(recipe, []);
      byRecipe.get(recipe).push(r);
    }

    console.log(`Found ${byRecipe.size} unique recipes.`);
    console.log("File path:", filePath);

    pool = await sql.connect(dbConfig);

    for (const [recipe, group] of byRecipe.entries()) {
      const first = group[0];

      // HEADER values inferred from Excel
      const template_no = recipe;
      const template_name = ensureString(first.output_item_dec).trim();
      const blocked = 0;
      const user_id = 1;

      // OUTPUT LINE base values
      const output_item = ensureString(first.output_item).trim();
      const output_desc = template_name;
      const output_uom = ensureString(first.output_item_uom).trim() || "EA";
      const output_loc = ensureString(first.output_item_location).trim() || "MAIN";
      const outShortcode = makeShortcode("OUT", output_item);

      if (!output_item) {
        console.log(`Skipping recipe ${recipe}: missing output_item`);
        continue;
      }

      // Compute SUM of units_per_100 for intake lines = SUM(qty_per)
      // (qty_per comes from input_item_qt_per)
      let output_units_per_100_sum = 0;
      for (const r of group) {
        const qty_per = ensureNumber(r.input_item_qt_per);
        if (qty_per !== null) output_units_per_100_sum += qty_per;
      }

      // 1) INSERT template_header (if not exists)
      const headerSql = `
        IF NOT EXISTS (
          SELECT 1 FROM [calibra].[dbo].[template_header]
          WHERE [template_no] = @template_no
        )
        INSERT INTO [calibra].[dbo].[template_header] (
          [template_no],
          [template_name],
          [blocked],
          [user_id],
          [created_at],
          [updated_at]
        )
        VALUES (
          @template_no,
          @template_name,
          @blocked,
          @user_id,
          GETDATE(),
          GETDATE()
        );
      `;

      await pool.request()
        .input("template_no", sql.NVarChar(50), template_no)
        .input("template_name", sql.NVarChar(255), template_name)
        .input("blocked", sql.Bit, blocked)
        .input("user_id", sql.Int, user_id)
        .query(headerSql);

      // 2) INSERT OUTPUT line (if not exists) — units_per_100 = sum of all intake qty_per
      const outputLineSql = `
        IF NOT EXISTS (
          SELECT 1 FROM [calibra].[dbo].[template_lines]
          WHERE [template_no] = @template_no
            AND [item_code]   = @item_code
            AND ISNULL([type], '') = 'Output'
        )
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
          'Output',
          'Yes',
          @shortcode,
          @unit_measure,
          @location,
          GETDATE(),
          GETDATE()
        );
      `;

      await pool.request()
        .input("template_no", sql.NVarChar(50), template_no)
        .input("item_code", sql.NVarChar(50), output_item)
        .input("description", sql.NVarChar(255), output_desc)
        .input("percentage", sql.Decimal(18, 6), 1)
        .input("units_per_100", sql.Decimal(18, 6), output_units_per_100_sum) // ✅ sum of all intake lines
        .input("shortcode", sql.NVarChar(50), outShortcode)
        .input("unit_measure", sql.NVarChar(50), output_uom)
        .input("location", sql.NVarChar(50), output_loc)
        .query(outputLineSql);

      // 3) INSERT INTAKE lines (one per Excel row)
      for (const r of group) {
        const input_item = ensureString(r.input_item).trim();
        const input_desc = ensureString(r.input_item_desc).trim();
        const input_uom = ensureString(r.input_item_uom).trim() || "EA";
        const input_loc = ensureString(r.input_item_location).trim() || "MAIN";
        const inShortcode = makeShortcode("IN", input_item);

        const qty_per = ensureNumber(r.input_item_qt_per);
        const units_per = ensureNumber(r.batch_size);

        if (!input_item) {
          console.log(`Recipe ${recipe}: skip (blank input_item)`);
          continue;
        }
        if (qty_per === null || units_per === null || units_per === 0) {
          console.log(
            `Recipe ${recipe}: skip ${input_item} (qty_per=${qty_per}, batch_size=${units_per})`
          );
          continue;
        }

        const percentage = qty_per / units_per;

        const intakeSql = `
          IF NOT EXISTS (
            SELECT 1 FROM [calibra].[dbo].[template_lines]
            WHERE [template_no] = @template_no
              AND [item_code]   = @item_code
              AND ISNULL([type], '') = 'Intake'
          )
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
            'Intake',
            'No',
            @shortcode,
            @unit_measure,
            @location,
            GETDATE(),
            GETDATE()
          );
        `;

        await pool.request()
          .input("template_no", sql.NVarChar(50), template_no)
          .input("item_code", sql.NVarChar(50), input_item)
          .input("description", sql.NVarChar(255), input_desc)
          .input("percentage", sql.Decimal(18, 6), percentage)
          .input("units_per_100", sql.Decimal(18, 6), qty_per) // qty_per per intake line
          .input("shortcode", sql.NVarChar(50), inShortcode)
          .input("unit_measure", sql.NVarChar(50), input_uom)
          .input("location", sql.NVarChar(50), input_loc)
          .query(intakeSql);

        console.log(`Recipe ${recipe}: Intake ${input_item} => %=${percentage}`);
      }

      console.log(`Done: ${recipe} (output units_per_100 sum=${output_units_per_100_sum})`);
    }

    console.log("Import completed successfully.");
  } catch (err) {
    console.error("Import failed:", err);
  } finally {
    try { if (pool) await pool.close(); } catch {}
  }
}

// Your local file path
// run("D:\\code\\WMSIntegrations\\Services\\Utils\\hjjkj.xlsx");

// Or your local Windows path:
const filePath = "D:\\code\\WMSIntegrations\\Services\\Utils\\1230M33.xlsx";
run(filePath);
console.log("File path:", filePath);
// processAndInsertTemplates(filePath);
