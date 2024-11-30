import { processLookup as DebeoningProcessLookup } from './lookup.js';
import { processLookup as SlicingProcessLookup } from './slicingLookup.js';

// Helper functions for lookups
const DebeoningLookup = (processName) => {
  return Object.values(DebeoningProcessLookup).find(
    (process) => process.process_name === processName
  ) || null;
};

const SlicingLookup = (processName) => {
  return SlicingProcessLookup.find(
    (process) => process.process_name === processName
  ) || null;
};

export const transformData = (responseData) => {
  const dateTime = responseData.timestamp
    ? new Date(responseData.timestamp).toISOString()
    : new Date().toISOString();

  const items = Array.isArray(responseData) ? responseData : [responseData];

  const orderNo = responseData.id ? responseData.id.toString() : "no_order_no";

  // List of item codes that trigger an additional production order
  const specialItemCodes = ["G1126", "G1164", "G1189", "G1229"];

  return items.flatMap((item, index) => {
    let processDetails = DebeoningLookup(item.process_name);

    // Fallback to SlicingLookup if not found in DebeoningLookup
    if (!processDetails) {
      processDetails = SlicingLookup(item.process_name);
    }

    if (!processDetails) {
      throw new Error(
        `Process name ${item.process_name} not found in any lookup`
      );
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
      routing: "production_order.bc",
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
    const additionalProductionOrder =
      specialItemCodes.includes(item.item_code) && {
        production_order_no: `SP_${orderNo}_${index + 1}`, // Unique order number for the additional production order
        ItemNo: "G1291", // Output item for the special production order
        Quantity: netWeight, // 1:1 ratio with the input
        uom: "KG",
        LocationCode: processDetails.output_location,
        BIN: item.bin || "",
        user: item.user_id || "EMUGA",
        line_no: 3000 + index * 1000, // Ensure line numbers are unique
        routing: "production_order.bc",
        date_time: dateTime,
        ProductionJournalLines: [
          {
            ItemNo: "G1291", // The output item
            Quantity: netWeight,
            uom: "KG",
            LocationCode: processDetails.output_location,
            BIN: item.bin || "",
            line_no: 4000 + index * 1000, // First line
            type: "output",
            date_time: dateTime,
            user: item.user_id || "EMUGA",
          },
          {
            ItemNo: item.item_code, // The intake item
            Quantity: netWeight, // 1:1 ratio with the output
            uom: "KG",
            LocationCode: processDetails.input_location,
            BIN: item.bin || "",
            line_no: 5000 + index * 1000, // Second line
            type: "consumption",
            date_time: dateTime,
            user: item.user_id || "EMUGA",
          },
        ],
      };

    // Combine the main and additional production orders (if applicable)
    return additionalProductionOrder
      ? [mainProductionOrder, additionalProductionOrder]
      : [mainProductionOrder];
  });
};


// export const transformData = (responseData) => {
//   // Use provided timestamp or fallback to the current time
//   const dateTime = responseData.timestamp
//     ? new Date(responseData.timestamp).toISOString()
//     : new Date().toISOString();

//   // Ensure responseData is an array for consistency in processing
//   const items = Array.isArray(responseData) ? responseData : [responseData];

//   // Generate a unique order number
//   const orderNo = responseData.id ? responseData.id.toString() : "no_order_no";

//   // Transform data
//   return [
//     {
//       production_order_no: (() => {
//         let processDetails = DebeoningLookup(items[0].process_name);

//         // Fallback to SlicingLookup if not found in DebeoningLookup
//         if (!processDetails) {
//           processDetails = SlicingLookup(items[0].process_name);
//         }

//         if (!processDetails) {
//           throw new Error(
//             `Process name ${items[0].process_name} not found in any lookup`
//           );
//         }

//         return `${processDetails.production_order_series}_${orderNo}`;
//       })(),
//       ItemNo: responseData.item_code,
//       Quantity: parseFloat(responseData.net_weight), // Convert string to number for Quantity
//       uom: "KG", // Default to "KG"
//       LocationCode: (() => {
//         let processDetails = DebeoningLookup(responseData.process_name);

//         // Fallback to SlicingLookup if not found in DebeoningLookup
//         if (!processDetails) {
//           processDetails = SlicingLookup(responseData.process_name);
//         }

//         if (!processDetails) {
//           throw new Error(
//             `Process name ${responseData.process_name} not found in any lookup`
//           );
//         }

//         return processDetails.output_location;
//       })(),
//       BIN: "", // Default to empty if not provided
//       user: responseData.user_id || "EMUGA", // Default to "EMUGA"
//       line_no: 1000, // Default to 1000
//       routing: "production_order.bc",
//       date_time: dateTime,
//       ProductionJournalLines: items.flatMap((item, index) => {
//         let processDetails = DebeoningLookup(item.process_name);

//         // Fallback to SlicingLookup if not found in DebeoningLookup
//         if (!processDetails) {
//           processDetails = SlicingLookup(item.process_name);
//         }

//         if (!processDetails) {
//           throw new Error(
//             `Process name ${item.process_name} not found in any lookup`
//           );
//         }

//         const netWeight = parseFloat(item.net_weight); // Ensure net weight is a number
//         const adjustedQuantity = Math.round((netWeight / (1 - processDetails.process_loss)) * 100) / 100;

//         // Handle splitting intake items for the "Fat Stripping Rinds" process
//         const intakeItems = processDetails.intake_item.split(',');
//         const intakeQuantityPerItem = Math.round((adjustedQuantity / intakeItems.length) * 100) / 100;

//         return [
//           {
//             ItemNo: item.item_code,
//             Quantity: netWeight, // Use net weight for output
//             uom: "KG",
//             LocationCode: processDetails.output_location,
//             BIN: item.bin || "",
//             line_no: 1000 + index * 1000, // Increment line_no by 1000 for each line
//             type: "output",
//             date_time: dateTime,
//             user: item.user_id || "EMUGA",
//           },
//           ...intakeItems.map((intakeItem, intakeIndex) => ({
//             ItemNo: intakeItem,
//             Quantity: intakeQuantityPerItem, // Divide quantity among intake items
//             uom: "KG",
//             LocationCode: processDetails.input_location,
//             BIN: item.bin || "",
//             line_no: 2000 + intakeIndex * 1000, // Increment line_no by 1000 for each intake line
//             type: "consumption",
//             date_time: dateTime,
//             user: item.user_id || "EMUGA",
//           })),
//         ];
//       }),
//     },
//   ];
// };

const mockData=`{"item_code":"G1276","actual_weight":"50.7","net_weight":"43.5","process_code":10,"product_type":2,"no_of_crates":3,"no_of_pieces":"0","user_id":21,"narration":null,"batch_no":"28LA6D9","created_at":"2024-11-29T13:18:56.475507Z","id":550621,"timestamp":"2024-11-29 16:18:56","process_name":"Fat Stripping Rinds","company_name":"FCL"}`

 console.log(JSON.stringify(transformData(JSON.parse(mockData))));