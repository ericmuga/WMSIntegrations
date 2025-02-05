import xlsx from 'xlsx';
import { getPool } from '../../config/default.js'; // Ensure the path is correct
import path from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';

// Fix the __dirname issue for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the Excel file
const filePath = path.join(__dirname, '../../Excel/UpdatePackingRecipes.xlsx');

export async function processPackingRecipes() {
  try {
    // Load the Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    // Get database connection pools for BOM and WMS
    const bomPool = await getPool('BOM');
    const wmsPool = await getPool('wms');

    for (const row of jsonData) {
      const {
        Process,
        output_item,
        recipe,
        output_item_uom,
        batch_size,
        output_item_location,
        input_item,
        input_item_desc,
        input_item_uom,
        input_item_qt_per,
        input_item_location,
        instruction, // Instruction column
      } = row;

      // Skip rows where instruction is blank
      if (!instruction) {
        console.log('Skipping row with no instruction');
        continue;
      }

      // Ensure all required fields are valid (Replace undefined/null values with empty strings)
      const sanitize = (value) => (value !== undefined && value !== null ? value : '');

      // Function to execute a query for both databases
      const executeForBothDatabases = async (query, params) => {
        // Execute query for BOM database
        const bomRequest = bomPool.request();
        for (const [key, value] of Object.entries(params)) {
          bomRequest.input(key, value.type, sanitize(value.value));
        }
        await bomRequest.query(query);

        // Execute query for WMS database
        const wmsRequest = wmsPool.request();
        for (const [key, value] of Object.entries(params)) {
          wmsRequest.input(key, value.type, sanitize(value.value));
        }
        await wmsRequest.query(query);
      };

      if (instruction === 'Remove') {
        // DELETE query
        const deleteQuery = `
          DELETE FROM RecipeData
          WHERE input_item = @input_item AND recipe = @recipe
        `;
        const params = {
          input_item: { type: sql.NVarChar, value: input_item },
          recipe: { type: sql.NVarChar, value: recipe },
        };
        await executeForBothDatabases(deleteQuery, params);
        console.log(`Deleted: input_item=${input_item}, recipe=${recipe}`);
      } else if (instruction.includes('Replace')) {
        // UPDATE query
        const [replaceItem, replaceLocation] = instruction.split(' to Replace ').map(str => str.trim());
        const updateQuery = `
          UPDATE RecipeData
          SET input_item = @replaceItem, input_item_location = @replaceLocation
          WHERE input_item = @input_item AND recipe = @recipe
        `;
        const params = {
          replaceItem: { type: sql.NVarChar, value: replaceItem },
          replaceLocation: { type: sql.NVarChar, value: replaceLocation },
          input_item: { type: sql.NVarChar, value: input_item },
          recipe: { type: sql.NVarChar, value: recipe },
        };
        await executeForBothDatabases(updateQuery, params);
        console.log(`Replaced: ${input_item} with ${replaceItem} in recipe=${recipe}`);
      } else {
        // INSERT query
        const insertQuery = `
          INSERT INTO RecipeData (
            Process, output_item, recipe, output_item_uom, batch_size,
            output_item_location, input_item, input_item_desc, input_item_uom,
            input_item_qt_per, input_item_location
          )
          VALUES (
            @Process, @output_item, @recipe, @output_item_uom, @batch_size,
            @output_item_location, @input_item, @input_item_desc, @input_item_uom,
            @input_item_qt_per, @input_item_location
          )
        `;
        const params = {
          Process: { type: sql.NVarChar, value: sanitize(Process) },
          output_item: { type: sql.NVarChar, value: sanitize(output_item) },
          recipe: { type: sql.NVarChar, value: sanitize(recipe) },
          output_item_uom: { type: sql.NVarChar, value: sanitize(output_item_uom) },
          batch_size: { type: sql.Float, value: batch_size || 0 }, // Default to 0 if undefined
          output_item_location: { type: sql.NVarChar, value: sanitize(output_item_location) },
          input_item: { type: sql.NVarChar, value: sanitize(input_item) },
          input_item_desc: { type: sql.NVarChar, value: sanitize(input_item_desc) },
          input_item_uom: { type: sql.NVarChar, value: sanitize(input_item_uom) },
          input_item_qt_per: { type: sql.Float, value: input_item_qt_per || 0 }, // Default to 0 if undefined
          input_item_location: { type: sql.NVarChar, value: sanitize(input_item_location) },
        };
        await executeForBothDatabases(insertQuery, params);
        console.log(`Inserted: input_item=${input_item}, recipe=${recipe}`);
      }
    }

    console.log('Packing recipes processed successfully.');
  } catch (error) {
    console.error('Error processing packing recipes:', error);
  }
}

// Call the function to process the packing recipes
processPackingRecipes();
