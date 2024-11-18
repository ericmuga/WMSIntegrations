import { getProcessDetails, getProcessByProcessName } from './lookup.js';
import logger from '../../logger.js';

export const transformData = (responseData) => {
  // const dateTime = new Date().toISOString(); // Get current timestamp for date_time
  const dateTime = new Date(responseData.timestamp).toISOString()|| new Date().toISOString(); // Get current timestamp for date_time

  // Check if responseData is an array, otherwise wrap it in an array
  const items = Array.isArray(responseData) ? responseData : [responseData];

  // logger.info(responseData);
  return [
    {
      
      production_order_no: getProcessByProcessName(items[0].process_name).production_order_series+'_'+responseData.id,

      ItemNo: responseData.item_code,
      Quantity: parseFloat(responseData.net_weight), // Convert string to number for Quantity
      uom: 'KG', // Default to "KG" if not provided
      LocationCode: getProcessByProcessName(responseData.process_name).output_location,
      BIN: "", // Default to empty if not provided
      user: responseData.user_id || "EMUGA", // Default to "EMUGA" if not provided
      line_no: 1000, // Default to 1000 if not provided
      routing: "production_order.bc",
      date_time: dateTime,
      ProductionJournalLines: items.flatMap((item, index) => {
        const processDetails = getProcessByProcessName(item.process_name);

        if (!processDetails) {
          throw new Error(`Process name ${item.process_name} not found in lookup`);
        }

        return [
          {
            ItemNo: item.item_code,
            Quantity: parseFloat(item.net_weight), // Convert string to number for Quantity
            uom: item.uom || "KG", // Assume default "KG" if not provided
            LocationCode: processDetails.output_location,
            BIN: item.bin || "",
            line_no: 1000, // Increment line_no by 1000 for each line
            type: "output",
            date_time: dateTime,
            user: item.user_id
          },
          {
            ItemNo: processDetails.intake_item,
            Quantity:Math.round((parseFloat(item.net_weight) / (1 - parseFloat(processDetails.process_loss))) * 100) / 100, // Convert string to number for Quantity
            uom: item.uom || "KG", // Assume default "KG" if not provided
            LocationCode: processDetails.input_location,
            BIN: item.bin || "",
            line_no: 2000, // Increment line_no by 1000 for each line
            type: "consumption",
            date_time: dateTime,
            user: item.user_id
          }
        ];
      })
    }
  ];
};
