import sql from 'mssql';
import { poolPromise } from '../../config/default.js'; // Database connection pool
import logger from '../../logger.js';

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

// export const fetchBOMData = async (process, outputItem) => {
//     const pool = await poolPromise;
//     const query = `
//         SELECT DISTINCT *
//         FROM RecipeData
//         WHERE Process = @process AND output_item = @outputItem;
//     `;
//     const result = await pool
//         .request()
//         .input('process', sql.VarChar, process)
//         .input('outputItem', sql.VarChar, outputItem)
//         .query(query);

//     return result.recordset;
// };
export const fetchBOMData = async (process, item) => {
    const pool = await poolPromise;
    const query = process
        ? `SELECT * FROM RecipeData WHERE Process = @process AND output_item = @item`
        : `SELECT * FROM RecipeData WHERE output_item = @item`;

    const request = pool.request().input('item', sql.VarChar, item);

    if (process) {
        request.input('process', sql.VarChar, process);
    }

    const result = await request.query(query);
    return result.recordset;
};


/**
 * Fetch mixture items dynamically from the database.
 * @returns {Set} - A set of excluded items from MBSolution and Salting processes.
 */
export const fetchMixtureItems = async () => {
    const pool = await poolPromise;
    const query = `
        SELECT DISTINCT output_item
        FROM RecipeData
        WHERE Process IN ('MBSolution', 'Salting');
    `;
    const result = await pool.request().query(query);
    return new Set(result.recordset.map(row => row.output_item));
};

/**
 * Filters out main intake items that are excluded based on specific conditions.
 * @param {Array} BOM - Bill of materials data.
 * @param {Set} excludedItems - Set of excluded output items for the process.
 * @returns {Object|null} - The row with the main intake item or null if not found.
 */
export const getMainIntakeItem = (BOM, excludedItems) => {
    return BOM.find(
        (row) =>
            row.input_item &&
            row.input_item.startsWith('G') &&
            !excludedItems.has(row.input_item)
    );
};

/**
 * Generates production orders for specific mixtures (e.g., salting, MBSolution).
 * @param {Object} mainItem - The main item requiring processing.
 * @param {String} processType - The process type (e.g., 'Salting', 'MBSolution').
 * @param {String} dateTime - Current timestamp.
 * @param {String} user - User triggering the process.
 * @param {Array} productionOrders - Array to accumulate production orders.
 */

export const generateMixtureOrders = async (mainItem, processType, dateTime, user, productionOrders,qty) => {
    const processBOM = await fetchBOMData(processType, mainItem.input_item);

    if (!processBOM.length) {
        logger.error(`No BOM data found for ${processType}: ${mainItem.input_item}`);
        return;
    }

    // const outputQuantity = parseFloat(mainItem.input_item_qt_per);
    const outputQuantity = qty;

    const mixtureOrder = constructProductionOrder({
        recipe: processBOM[0].recipe,
        outputItem: mainItem.input_item,
        outputQuantity,
        uom: processBOM[0].output_item_uom,
        BOM: processBOM,
        user,
        dateTime,
        id: processType,
    });

    productionOrders.push(mixtureOrder);

    // Handle cascading logic for water/ice
    for (const line of processBOM) {
        if (SPECIAL_ITEMS.includes(line.input_item)) {
            const specialOrder = createSpecialProductionOrder({
                ItemNo: line.input_item,
                Quantity: line.input_item_qt_per * outputQuantity,
                uom: line.input_item_uom,
                LocationCode: line.input_item_location,
            }, dateTime, mainItem.input_item);

            productionOrders.push(specialOrder);
        }
    }
};



/**
 * Logs process BOM and item data to the BOMValidation table.
 * @param {Object} params - Parameters for logging.
 * @param {string} params.fg - Finished good (initial item).
 * @param {string} params.process - Current process.
 * @param {string} params.item - Current item.
 * @param {number} params.qtyPer - Quantity per batch.
 * @param {number} params.loss - Loss value (default is 0).
 * @param {number} params.batchSize - Batch size.
 */

export const logProcessBOM = async ({ fg, process, item, qtyPer, loss = 0, batchSize }) => {
    try {
        const pool = await poolPromise; // Reuse the shared pool connection
        await pool.request()
            .input('FG', sql.NVarChar, fg)
            .input('Process', sql.NVarChar, process)
            .input('Item', sql.NVarChar, item)
            .input('QtyPer', sql.Float, qtyPer)
            .input('Loss', sql.Float, loss)
            .input('BatchSize', sql.Float, batchSize)
            .query(`
                INSERT INTO [BOM].[dbo].[BOMValidation] ([FG], [Process], [Item], [QtyPer], [Loss], [BatchSize])
                VALUES (@FG, @Process, @Item, @QtyPer, @Loss, @BatchSize)
            `);
        logger.info(`Logged BOM data: FG=${fg}, Process=${process}, Item=${item}`);
    } catch (error) {
        logger.error(`Failed to log BOM data for Item: ${item}, Process: ${process}. Error: ${error.message}`);
    }
};




// export const fetchBOMDataForItem = async ( outputItem) => {
//     const pool = await poolPromise;
//     const query = `
//         SELECT DISTINCT *
//         FROM RecipeData
//         WHERE  output_item = @outputItem;
//     `;
//     const result = await pool
//         .request()
//         .input('outputItem', sql.VarChar, outputItem)
//         .query(query);

//     return result.recordset;
// };


/**
 * Cleans and removes duplicate lines from production orders.
 * @param {Array} productionOrders - The array of production orders to clean.
 * @returns {Array} - The cleaned production orders.
 */
export const cleanProductionOrders = (productionOrders) => {
    return productionOrders.map((order) => {
        const { ProductionJournalLines } = order;

        const uniqueLines = [];
        const seenLines = new Set();

        ProductionJournalLines.forEach((line) => {
            const lineKey = `${line.ItemNo}_${line.line_no}_${line.type}`;
            if (!seenLines.has(lineKey)) {
                seenLines.add(lineKey);
                uniqueLines.push({ ...line }); // Deep clone
            }
        });

        return {
            ...order,
            ProductionJournalLines: uniqueLines,
        };
    });
};

/**
 * Constructs a production order.
 * 
 * @param {Object} params - Parameters for constructing the production order.
 * @returns {Object} - The constructed production order.
 */
export const constructProductionOrder = ({
    recipe,
    outputItem,
    outputQuantity,
    uom,
    BOM,
    user,
    dateTime,
    id,
}) => {
    const productionOrder = {

        production_order_no: `${recipe}_${id}`,
        ItemNo: outputItem,
        Quantity: roundTo4Decimals(outputQuantity),
        uom,
        LocationCode: BOM[0].output_item_location || '',
        BIN: '',
        user: user || '',
        line_no: 1000,
        routing: BOM[0].Process || '',
        date_time: dateTime,
        ProductionJournalLines: [],
    };

    // Add the output line
    productionOrder.ProductionJournalLines.push({
        ItemNo: outputItem,
        Quantity: roundTo4Decimals(outputQuantity),
        uom,
        LocationCode: BOM[0].output_item_location || '',
        BIN: '',
        line_no: 1000,
        type: 'output',
        date_time: dateTime,
        user: user || '',
    });

    // Add consumption lines
    BOM.forEach((line, index) => {
        productionOrder.ProductionJournalLines.push({
            ItemNo: line.input_item,
            Quantity: roundTo4Decimals(line.input_item_qt_per * outputQuantity / BOM[0].batch_size),
            uom: line.input_item_uom,
            LocationCode: line.input_item_location || '',
            BIN: '',
            line_no: 2000 + index * 1000,
            type: 'consumption',
            date_time: dateTime,
            user: user || '',
        });
    });

    return productionOrder;
};


/**
 * Creates a special production order for water/ice.
 * @param {Object} specialItem - Special item details.
 * @param {String} dateTime - Current timestamp.
 * @param {String} context - Context form  \\ production.
 * @returns {Object} - Special production order object.
 */
export const createSpecialProductionOrder = (specialItem, dateTime, context) => {
    const uniquePart = Date.now() % 100000;
    return {
        production_order_no: `WP${specialItem.ItemNo}${context}_${uniquePart}`,
        ItemNo: specialItem.ItemNo,
        Quantity: roundTo4Decimals(specialItem.Quantity)/100,
        uom: specialItem.uom,
        LocationCode: specialItem.LocationCode,
        BIN: '',
        user: '',
        line_no: 1000,
        routing: 'water_ice',
        date_time: dateTime,
        ProductionJournalLines: [
            {
                ItemNo: specialItem.ItemNo,
                Quantity: roundTo4Decimals(specialItem.Quantity)/100,
                uom: specialItem.uom,
                LocationCode: specialItem.LocationCode,
                BIN: '',
                line_no: 1000,
                type: 'output',
                date_time: dateTime,
                user: '',
            },
        ],
    };
};




export const SALTING_PROCESS = 'Salting';
export const MBSOLUTION_PROCESS = 'MBSolution';
export const SPECIAL_ITEMS = ['G8900', 'G8901'];