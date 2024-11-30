import { minceLookup } from './Mincing.js';

const PROCESS_PREFIX = "mn"; // Constant for the process prefix

export const transformData = (responseData) => {
  const dateTime = new Date(responseData.production_date || Date.now()).toISOString(); // Use provided production_date or current timestamp

  // Find the matching lookup entry
  const lookupEntry = minceLookup.find(
    (entry) =>
      entry.from.toString() === responseData.transfer_from_location &&
      entry.to.toString() === responseData.transfer_to_location &&
      entry.intake_items.includes(responseData.product_code)
  );

  if (!lookupEntry) {
    throw new Error(`No matching entry found in minceLookup for product_code: ${responseData.product_code}`);
  }

  const intakeQuantity = parseFloat(responseData.receiver_total_weight); // Convert string weight to number
  const outputQuantity = Math.round((1 - lookupEntry.process_loss) * intakeQuantity * 100) / 100; // Calculate and round output quantity

  const orderId = responseData.id ? responseData.id.toString() : "no_id"; // Use provided id or fallback

  return [
    {
      production_order_no: `${PROCESS_PREFIX}_${orderId}`, // Construct production order number
      Quantity: outputQuantity, // Output quantity
      uom: 'KG', // Default to "KG"
      LocationCode: responseData.transfer_to_location, // Output location
      BIN: '', // Default BIN to empty
      user: responseData.received_by || "DEFAULT", // Use received_by or default
      line_no: 1000, // Default line number
      routing: "production_order.bc", // Default routing
      date_time: dateTime,
      ProductionJournalLines: [
        {
          ItemNo: responseData.product_code, // Intake item from data
          Quantity: intakeQuantity, // Intake quantity
          uom: 'KG', // Default to "KG"
          LocationCode: responseData.transfer_from_location, // Intake location
          BIN: '', // Default BIN to empty
          line_no: 1000, // Line number for intake
          type: "consumption",
          date_time: dateTime,
          user: responseData.received_by || "DEFAULT"
        },
        {
          ItemNo: lookupEntry.output_item, // Output item from lookup
          Quantity: outputQuantity, // Output quantity
          uom: 'KG', // Default to "KG"
          LocationCode: responseData.transfer_to_location, // Output location
          BIN: '', // Default BIN to empty
          line_no: 2000, // Line number for output
          type: "output",
          date_time: dateTime,
          user: responseData.received_by || "DEFAULT"
        }
      ]
    }
  ];
};
