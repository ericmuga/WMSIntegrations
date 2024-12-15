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

