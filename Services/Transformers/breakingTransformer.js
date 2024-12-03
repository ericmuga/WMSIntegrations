import { getProcessDetails} from './lookup.js';
// import { consumeBreakingData } from '../Consumers/consumeBreakingQueue.js';
// import { consumeBeheadingData } from '../Consumers/consumeBeheadingQueue.js';

// const test_data=`{"item_code":"G1108","no_of_items":"16","actual_weight":"38.1","net_weight":"30.6","user_id":12,"carcass_type":"G1031","process_code":"3","product_type":"1","id":191672,"timestamp":"2024-11-26 13:34:29","process_name":"Breaking Sow into Leg,Mid,&Shd","company_name":"FCL"}`

export const transformData = (responseData) => {
  // const dateTime = new Date().toISOString(); // Get current timestamp for date_time
  const dateTime = new Date(responseData.timestamp).toISOString()|| new Date().toISOString(); // Get current timestamp for date_time

  // Check if responseData is an array, otherwise wrap it in an array
  const items = Array.isArray(responseData) ? responseData : [responseData];

  const order_no = responseData.id ? responseData.id.toString() : "no_order_no";
  // console.log(items[0]);

  // console.log(getProcessDetails(parseInt(items[0].process_code)))

  return [
    {
      production_order_no: getProcessDetails(parseInt(items[0].process_code)).production_order_series+'_'+order_no,
      ItemNo: responseData.item_code,
      Quantity: parseFloat(responseData.net_weight), // Convert string to number for Quantity
      uom: 'KG', // Default to "KG" if not provided
      LocationCode: getProcessDetails(parseInt(responseData.process_code)).output_location,
      BIN: "", // Default to empty if not provided
      user: responseData.user_id || "DEFAULT", // Default to "EMUGA" if not provided
      line_no: 1000, // Default to 1000 if not provided
      routing: "production_order.bc",
      date_time: dateTime,
      ProductionJournalLines: items.flatMap((item, index) => {
        const processDetails = getProcessDetails(parseInt(item.process_code));

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
// let br=consumeBreakingData();
