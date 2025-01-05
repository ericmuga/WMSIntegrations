// lookup.js

export const processLookup = {
  1: { 
      process_code: 0, 
      shortcode: "BP", 
      process_name: "Behead Pig", 
      intake_item: "G0110", 
      input_location: "1020", 
      output_location: "1570", 
      production_order_series: `P${String(0).padStart(2, '0')}`,
      process_loss: 0.02 // 5% loss
    //   process_loss: 0.00 // 5% loss
  },
  2: { 
      process_code: 1, 
      shortcode: "BS", 
      process_name: "Behead Sow", 
      intake_item: "G0111", 
      input_location: "1020", 
      output_location: "1570", 
      production_order_series: `P${String(1).padStart(2, '0')}`,
      process_loss: 0.04 // 4% loss
  },
  3: { 
      process_code: 2, 
      shortcode: "PB", 
      process_name: "Breaking Pig, (Leg, Mdl, Shld)", 
      intake_item: "G1030", 
      input_location: "1570", 
      output_location: "1570", 
      production_order_series: `P${String(2).padStart(2, '0')}`,
      process_loss: 0.00 // 3% loss
  },
  4: { 
      process_code: 3, 
      shortcode: "SB", 
      process_name: "Breaking Sow into Leg, Mid, & Shd", 
      intake_item: "G1031", 
      input_location: "1570", 
      output_location: "1570", 
      production_order_series: `P${String(3).padStart(2, '0')}`,
      process_loss: 0.06 // 6% loss
  },
  5: { 
      process_code: 4, 
      shortcode: "DL", 
      process_name: "Debone Pork Leg", 
      intake_item: "G1100", 
      input_location: "1570", 
      output_location: "1570", 
      production_order_series: `P${String(4).padStart(2, '0')}`,
      process_loss: 0.00 // 2% loss
  },
  6: { 
      process_code: 5, 
      shortcode: "DM", 
      process_name: "Debone Pork Middle", 
      intake_item: "G1102", 
      input_location: "1570", 
      output_location: "1570", 
      production_order_series: `P${String(5).padStart(2, '0')}`,
      process_loss: 0.00 // 3% loss
  },
  7: { 
      process_code: 6, 
      shortcode: "DS", 
      process_name: "Debone Pork Shoulder", 
      intake_item: "G1101", 
      input_location: "1570", 
      output_location: "1570", 
      production_order_series: `P${String(6).padStart(2, '0')}`,
      process_loss: 0.00 // 4% loss
  },
  8: { 
      process_code: 7, 
      shortcode: "DSL", 
      process_name: "Debone Sow Leg", 
      intake_item: "G1108", 
      input_location: "1570", 
      output_location: "1570", 
      production_order_series: `P${String(7).padStart(2, '0')}`,
      process_loss: 0.05 // 5% loss
  },
//   9: { 
//     process_code: 8, 
//     shortcode: "SL", 
//     process_name: "Slicing parts for slices, portions", 
//     intake_item: "G1168", 
//     output_item: "G1211",
//     input_location: "1570", 
//     output_location: "1570", 
//     production_order_series: `P${String(8).padStart(2, '0')}`,
//     process_loss: 0.00 // 5% loss
// },
  11: { 
      process_code: 10, 
      shortcode: "FS", 
      process_name: "Fat Stripping Rinds", 
      intake_item: "G1101,G1102,G1100", 
      input_location: "1570", 
      output_location: "1570", 
      production_order_series: `P${String(10).padStart(2, '0')}`,
      process_loss: 0.00 // 7% loss
  },
  10005: { 
      process_code: 17, 
      shortcode: "DSM", 
      process_name: "Debone Sow Middle", 
      intake_item: "G1110", 
      input_location: "1570", 
      output_location: "1570", 
      production_order_series: `P${String(9).padStart(2, '0')}`,
      process_loss: 0.04 // 4% loss
  },
  10006: { 
      process_code: 18, 
      shortcode: "DSS", 
      process_name: "Debone Sow Shoulder", 
      intake_item: "G1109", 
      input_location: "1570", 
      output_location: "1570", 
      production_order_series: `P${String(8).padStart(2, '0')}`,
      process_loss: 0.03 // 3% loss
  },
  20005: { 
      process_code: 101, 
      shortcode: "D/B", 
      process_name: "Deboning Beef", 
      intake_item: "Deboned Beef", 
      input_location: "1570", 
      output_location: "1570", 
      production_order_series: `P${String(101).padStart(2, '0')}`,
      process_loss: 0.05 // 5% loss
  }
  

};

  
  export const getProcessDetails = (processId) => {
    return Object.values(processLookup).find((process) => process.process_code === processId) || null;
    // return processLookup[processId] || null;
  };
  
  export const getProcessByShortCode = (shortCode) => {
    return Object.values(processLookup).find((process) => process.shortcode === shortCode) || null;
  };
  
  export const getProcessByProcessName = (processName) => {    
    return Object.values(processLookup).find((process) => process.process_name === processName) || null;
  };
  