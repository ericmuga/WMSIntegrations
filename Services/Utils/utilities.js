import sql from 'mssql';
import { poolPromise } from '../../config/default.js'; // Database connection pool
// import logger from '../../logger.js';

export const roundTo4Decimals = (num) => {
    const validNum = parseFloat(num);
    if (isNaN(validNum)) {
        throw new Error(`Invalid number: ${num}`);
    }
    return parseFloat(validNum.toFixed(4));
};


export const fetchProcessForOutputItem = async (outputItem) => {
    const pool = await poolPromise;
    const query = `
        SELECT TOP 1 [Process]
        FROM [BOM].[dbo].[RecipeData]
        WHERE [output_item] = @outputItem;
    `;
    const result = await pool
        .request()
        .input('outputItem', sql.VarChar, outputItem)
        .query(query);

    if (result.recordset.length === 0) {
        throw new Error(`No Process found for output_item: ${outputItem}`);
    }

    return result.recordset[0].Process;
};

export const fetchBOMData = async (process, outputItem) => {
    const pool = await poolPromise;
    const query = `
        SELECT DISTINCT *
        FROM RecipeData
        WHERE Process = @process AND output_item = @outputItem;
    `;
    const result = await pool
        .request()
        .input('process', sql.VarChar, process)
        .input('outputItem', sql.VarChar, outputItem)
        .query(query);

    return result.recordset;
};
