// lookup.js

const processLookup = {
    1: { process_code: 0, shortcode: "BP", process_name: "Behead Pig", intake_item: "G0110", location_code: "1020" },
    2: { process_code: 1, shortcode: "BS", process_name: "Behead Sow", intake_item: "G0111", location_code: "1020" },
    3: { process_code: 2, shortcode: "PB", process_name: "Breaking Pig (Leg, Mdl, Shld)", intake_item: "G1030", location_code: "1570" },
    4: { process_code: 3, shortcode: "SB", process_name: "Breaking Sow into Leg, Mid, & Shd", intake_item: "G1031", location_code: "1570" },
    5: { process_code: 4, shortcode: "DL", process_name: "Debone Pork Leg", intake_item: "G1100", location_code: "1570" },
    6: { process_code: 5, shortcode: "DM", process_name: "Debone Pork Middle", intake_item: "G1102", location_code: "1570" },
    7: { process_code: 6, shortcode: "DS", process_name: "Debone Pork Shoulder", intake_item: "G1101", location_code: "1570" },
    8: { process_code: 7, shortcode: "DSL", process_name: "Debone Sow Leg", intake_item: "G1108", location_code: "1570" },
    // 9: { process_code: 8, shortcode: "SL", process_name: "Slicing parts for slices, portions", intake_item: "Pork Parts for Slicing", location_code: "LOC009" },
    // 10: { process_code: 9, shortcode: "TR", process_name: "Trim & Roll", intake_item: "Trimmed Pork", location_code: "LOC010" },
    11: { process_code: 10, shortcode: "FS", process_name: "Fat Stripping Rinds", intake_item: "Pork Fat Rinds", location_code: "LOC011" },
    // 12: { process_code: 11, shortcode: "RPL", process_name: "Rolling Pork Legs", intake_item: "Pork Legs", location_code: "LOC012" },
    // 13: { process_code: 12, shortcode: "RPS", process_name: "Rolling Pork Shoulders", intake_item: "Pork Shoulders", location_code: "LOC013" },
    // 14: { process_code: 13, shortcode: "BN", process_name: "Bones", intake_item: "Bones", location_code: "LOC014" },
    // 10002: { process_code: 14, shortcode: "CK", process_name: "Cooking", intake_item: "Cooked Meat", location_code: "LOC015" },
    // 10003: { process_code: 15, shortcode: "MR", process_name: "Marination", intake_item: "Marinated Meat", location_code: "LOC016" },
    // 10004: { process_code: 16, shortcode: "RPM", process_name: "Rolling Pork Middle", intake_item: "Pork Middle", location_code: "LOC017" },
    10005: { process_code: 17, shortcode: "DSM", process_name: "Debone Sow Middle", intake_item: "G1110", location_code: "LOC018" },
    10006: { process_code: 18, shortcode: "DSS", process_name: "Debone Sow Shoulder", intake_item: "G1109", location_code: "LOC019" },
    20005: { process_code: 101, shortcode: "D/B", process_name: "Deboning Beef", intake_item: "Deboned Beef", location_code: "LOC020" }
    // 20006: { process_code: 102, shortcode: "S/B", process_name: "Slicing Beef", intake_item: "Sliced Beef", location_code: "LOC021" },
    // 20007: { process_code: 103, shortcode: "T/B", process_name: "Trimming Beef", intake_item: "Trimmed Beef", location_code: "LOC022" },
    // 20008: { process_code: 104, shortcode: "R/B", process_name: "Rolling Beef", intake_item: "Rolled Beef", location_code: "LOC023" },
    // 20009: { process_code: 105, shortcode: "M/B", process_name: "Maturing Beef", intake_item: "Matured Beef", location_code: "LOC024" },
    // 20010: { process_code: 106, shortcode: "PCK/B", process_name: "Packaging Beef", intake_item: "Packaged Beef", location_code: "LOC025" }
  };
  
  export const getProcessDetails = (processId) => {
    return processLookup[processId] || null;
  };
  
  export const getProcessByShortCode = (shortCode) => {
    return Object.values(processLookup).find((process) => process.shortcode === shortCode) || null;
  };

 export const getProcessByProcessName = (processName) => {    
    return Object.values(processLookup).find((process) => process.process_name === processName) || null;
}