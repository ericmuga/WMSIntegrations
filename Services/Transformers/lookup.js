// lookup.js

const processLookup = {
    1: { 
      process_code: 0, 
      shortcode: "BP", 
      process_name: "Behead Pig", 
      intake_item: "G0110", 
      input_location: "1020", 
      output_location: "1570", 
      production_order_series: `P${String(0).padStart(3, '0')}`
    },
    2: { 
      process_code: 1, 
      shortcode: "BS", 
      process_name: "Behead Sow", 
      intake_item: "G0111", 
      input_location: "1020", 
      output_location: "1570", 
      production_order_series: `P${String(1).padStart(3, '0')}`
    },
    3: { 
      process_code: 2, 
      shortcode: "PB", 
      process_name: "Breaking Pig, (Leg, Mdl, Shld)", 
      intake_item: "G1030", 
      input_location: "1570", 
      output_location: "1570", 
      production_order_series: `P${String(2).padStart(3, '0')}`
    },
    4: { 
      process_code: 3, 
      shortcode: "SB", 
      process_name: "Breaking Sow into Leg, Mid, & Shd", 
      intake_item: "G1031", 
      input_location: "1570", 
      output_location: "1570", 
      production_order_series: `P${String(3).padStart(3, '0')}`
    },
    5: { 
      process_code: 4, 
      shortcode: "DL", 
      process_name: "Debone Pork Leg", 
      intake_item: "G1100", 
      input_location: "1570", 
      output_location: "1570", 
      production_order_series: `P${String(4).padStart(3, '0')}`
    },
    6: { 
      process_code: 5, 
      shortcode: "DM", 
      process_name: "Debone Pork Middle", 
      intake_item: "G1102", 
      input_location: "1570", 
      output_location: "1570", 
      production_order_series: `P${String(5).padStart(3, '0')}`
    },
    7: { 
      process_code: 6, 
      shortcode: "DS", 
      process_name: "Debone Pork Shoulder", 
      intake_item: "G1101", 
      input_location: "1570", 
      output_location: "2570", 
      production_order_series: `P${String(6).padStart(3, '0')}`
    },
    8: { 
      process_code: 7, 
      shortcode: "DSL", 
      process_name: "Debone Sow Leg", 
      intake_item: "G1108", 
      input_location: "1570", 
      output_location: "1570", 
      production_order_series: `P${String(7).padStart(3, '0')}`
    },
    11: { 
      process_code: 10, 
      shortcode: "FS", 
      process_name: "Fat Stripping Rinds", 
      intake_item: "Pork Fat Rinds", 
      input_location: "LOC011", 
      output_location: "LOC021", 
      production_order_series: `P${String(10).padStart(3, '0')}`
    },
    10005: { 
      process_code: 17, 
      shortcode: "DSM", 
      process_name: "Debone Sow Middle", 
      intake_item: "G1110", 
      input_location: "LOC018", 
      output_location: "LOC028", 
      production_order_series: `P${String(9).padStart(3, '0')}`
    },
    10006: { 
      process_code: 18, 
      shortcode: "DSS", 
      process_name: "Debone Sow Shoulder", 
      intake_item: "G1109", 
      input_location: "LOC019", 
      output_location: "LOC029", 
      production_order_series: `P${String(8).padStart(3, '0')}`
    },
    20005: { 
      process_code: 101, 
      shortcode: "D/B", 
      process_name: "Deboning Beef", 
      intake_item: "Deboned Beef", 
      input_location: "LOC020", 
      output_location: "LOC030", 
      production_order_series: `P${String(101).padStart(3, '0')}`
    }
  };
  
  export const getProcessDetails = (processId) => {
    return processLookup[processId] || null;
  };
  
  export const getProcessByShortCode = (shortCode) => {
    return Object.values(processLookup).find((process) => process.shortcode === shortCode) || null;
  };
  
  export const getProcessByProcessName = (processName) => {    
    return Object.values(processLookup).find((process) => process.process_name === processName) || null;
  };
  