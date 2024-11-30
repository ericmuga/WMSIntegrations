import { minceLookup } from './Mincing.js';

const PROCESS_PREFIX = "MC"; // Constant for the process prefix

export const transformData = (responseData) => {
  // Ensure the input is an array
  const dataArray = Array.isArray(responseData) ? responseData : [responseData];

  return dataArray.map((data) => {
    const dateTime = new Date(data.production_date || Date.now()).toISOString(); // Use provided production_date or current timestamp

    const lookupEntry = minceLookup.find((entry) => {
      const matchesFrom = parseInt(entry.from) === parseInt(data.transfer_from_location);
      const matchesTo = parseInt(entry.to) === parseInt(data.transfer_to_location);
      const matchesProduct = entry.intake_items.includes(data.product_code.trim());

      return matchesFrom && matchesTo && matchesProduct;
    });

    if (!lookupEntry) {
      console.warn(`No matching entry found in minceLookup for product_code: ${data.product_code}`);
      return null; // Skip this item if no match is found
    }

    const intakeQuantity = parseFloat(data.receiver_total_weight); // Convert string weight to number
    const outputQuantity = Math.round((1 - lookupEntry.process_loss) * intakeQuantity * 100) / 100; // Calculate and round output quantity
    const orderId = data.id ? data.id.toString() : Date.now().toString(); // Use provided id or fallback

    return {
        production_order_no: `${PROCESS_PREFIX}_${orderId}`,
        Quantity: outputQuantity,
        uom: 'KG',
        ItemNo: lookupEntry.output_item,
        LocationCode: data.transfer_to_location,
        BIN: '',
        user: data.received_by || "DEFAULT",
        line_no: 1000,
        routing: "production_order.bc",
        date_time: dateTime,
        ProductionJournalLines: [
          {
            ItemNo: data.product_code.trim(),
            Quantity: intakeQuantity,
            uom: 'KG',
            LocationCode: data.transfer_from_location,
            BIN: '',
            line_no: 1000,
            type: "consumption",
            date_time: dateTime,
            user: data.received_by || "DEFAULT"
          },
          {
            ItemNo: lookupEntry.output_item,
            Quantity: outputQuantity,
            uom: 'KG',
            LocationCode: data.transfer_to_location,
            BIN: '',
            line_no: 2000,
            type: "output",
            date_time: dateTime,
            user: data.received_by || "DEFAULT"
          }
        ]
      };
      
  }).filter((result) => result !== null); // Remove null entries
};
