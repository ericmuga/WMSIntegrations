import { processLookup as DebeoningProcessLookup } from './lookup.js';
import { processLookup as SlicingProcessLookup } from './slicingLookup.js';

// Helper functions for lookups
const DebeoningLookup = (process_code) => {
  return Object.values(DebeoningProcessLookup).find(
    (process) => process.process_code === process_code
  ) || null;
};

const SlicingLookup = (process_code, item_code) => {
  return SlicingProcessLookup.find(
    (process) =>
      parseInt(process.process_code) === parseInt(process_code) &&
      process.output_item === item_code // Match the output item with the provided item_code
  ) || null;
};

export const transformData = (responseData) => {
  const dateTime = responseData.timestamp
    ? new Date(responseData.timestamp).toISOString()
    : new Date().toISOString();

  const items = Array.isArray(responseData) ? responseData : [responseData];

  const orderNo = responseData.id ? responseData.id.toString() : "no_order_no";

  // List of item codes that trigger an additional production order
  const specialItemCodes = ["G1126", "G1164", "G1189", "G1229", "G1319"];

  return items.reduce((acc, item, index) => {
    let processDetails = DebeoningLookup(item.process_code);

    // Fallback to SlicingLookup if not found in DebeoningLookup
    if (!processDetails) {
      processDetails = SlicingLookup(item.process_code, item.item_code);
    }

    // Skip this item if no matching process details are found
    if (!processDetails) {
      return acc; // Skip adding anything for this item
    }

    const netWeight = parseFloat(item.net_weight);
    const adjustedQuantity = Math.round((netWeight / (1 - processDetails.process_loss)) * 100) / 100;

    const intakeItems = processDetails.intake_item.split(",");
    const intakeQuantityPerItem = Math.round((adjustedQuantity / intakeItems.length) * 100) / 100;

    // Create the main production order
    const mainProductionOrder = {
      production_order_no: `${processDetails.production_order_series}_${orderNo}`,
      ItemNo: item.item_code,
      Quantity: netWeight,
      uom: "KG",
      LocationCode: processDetails.output_location,
      BIN: item.bin || "",
      user: item.user_id || "EMUGA",
      line_no: 1000 + index * 1000,
      routing: "deboning",
      date_time: dateTime,
      ProductionJournalLines: [
        ...intakeItems.map((intakeItem, intakeIndex) => ({
          ItemNo: intakeItem,
          Quantity: intakeQuantityPerItem,
          uom: "KG",
          LocationCode: processDetails.input_location,
          BIN: item.bin || "",
          line_no: 2000 + intakeIndex * 1000,
          type: "consumption",
          date_time: dateTime,
          user: item.user_id || "EMUGA",
        })),
        {
          ItemNo: item.item_code,
          Quantity: netWeight,
          uom: "KG",
          LocationCode: processDetails.output_location,
          BIN: item.bin || "",
          line_no: 1000,
          type: "output",
          date_time: dateTime,
          user: item.user_id || "EMUGA",
        },
      ],
    };

    // Check if an additional production order needs to be created
    if (specialItemCodes.includes(item.item_code)) {
      const additionalProductionOrder = {
        production_order_no: `SP_${orderNo}_${index + 1}`,
        ItemNo: "G1291",
        Quantity: netWeight,
        uom: "KG",
        LocationCode: processDetails.output_location,
        BIN: item.bin || "",
        user: item.user_id || "EMUGA",
        line_no: 3000 + index * 1000,
        routing: "production_order.bc",
        date_time: dateTime,
        ProductionJournalLines: [
          {
            ItemNo: "G1291",
            Quantity: netWeight,
            uom: "KG",
            LocationCode: processDetails.output_location,
            BIN: item.bin || "",
            line_no: 4000 + index * 1000,
            type: "output",
            date_time: dateTime,
            user: item.user_id || "EMUGA",
          },
          {
            ItemNo: item.item_code,
            Quantity: netWeight,
            uom: "KG",
            LocationCode: processDetails.input_location,
            BIN: item.bin || "",
            line_no: 5000 + index * 1000,
            type: "consumption",
            date_time: dateTime,
            user: item.user_id || "EMUGA",
          },
        ],
      };
      acc.push(additionalProductionOrder);
    }

    acc.push(mainProductionOrder); // Add the main production order to the accumulator
    return acc;
  }, []); // Start with an empty array
};




