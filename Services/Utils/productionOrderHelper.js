import { roundTo4Decimals } from './utilities.js';

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
    productionType,
}) => {
    const outputLocation = BOM[0]?.output_item_location || ''; // Ensure fallback for missing location

    // Construct the output line
    const mainOutputLine = {
        ItemNo: outputItem,
        Quantity: roundTo4Decimals(outputQuantity),
        uom,
        LocationCode: outputLocation,
        BIN: '',
        line_no: 1000,
        type: 'output',
        date_time: dateTime,
        user,
    };

    // Construct unique consumption lines
    const consumptionLines = BOM.map((row, index) => ({
        ItemNo: row.input_item,
        Quantity: roundTo4Decimals(outputQuantity * parseFloat(row.input_item_qt_per) / parseFloat(BOM[0].batch_size)),
        uom: row.input_item_uom,
        LocationCode: row.input_item_location,
        BIN: '',
        line_no: 2000 + index * 1000, // Ensure unique line numbers
        type: 'consumption',
        date_time: dateTime,
        user,
    }));

    // // Log the constructed lines for debugging
    // logger.debug(`Main Output Line: ${JSON.stringify(mainOutputLine)}`);
    // logger.debug(`Consumption Lines: ${JSON.stringify(consumptionLines)}`);

    return {
        production_order_no: `${recipe}_${productionType}`,
        ItemNo: outputItem,
        Quantity: roundTo4Decimals(outputQuantity),
        uom,
        LocationCode: outputLocation,
        BIN: '',
        user,
        line_no: 1000,
        routing: BOM[0].Process,
        date_time: dateTime,
        ProductionJournalLines: [mainOutputLine, ...consumptionLines],
    };
};
