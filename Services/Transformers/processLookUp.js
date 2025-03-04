import { getPool } from '../../config/default.js'; // Database connection pool

let processLookupCache = {};

export const fetchProcessLookup = async () => {
  try {
    const pool = await getPool('wms');
    const result = await pool.request().query(`
      SELECT 
        process_id, 
        process_code, 
        shortcode, 
        process_name, 
        intake_item, 
        input_location, 
        output_location, 
        production_order_series, 
        process_loss 
      FROM process_lookup
    `);

    // Cache the lookup results
    processLookupCache = result.recordset.reduce((acc, row) => {
      acc[row.process_code] = row;
      return acc;
    }, {});

    console.log("✅ Process lookup loaded from database.");
    return processLookupCache;
  } catch (error) {
    console.error("❌ Error loading process lookup:", error.message);
    throw error;
  }
};

// Helper Functions
export const getProcessDetails = (processCode) => {
  return processLookupCache[processCode] || null;
};

export const getProcessByShortCode = (shortcode) => {
  return Object.values(processLookupCache).find(p => p.shortcode === shortcode) || null;
};

export const getProcessByProcessName = (processName) => {
  return Object.values(processLookupCache).find(p => p.process_name === processName) || null;
};
