import fs from 'fs';
import path from 'path';
const lookup={
    process_key:'P20'
}

// Load the JSON file generated from the Excel
const lookupFilePath = path.resolve('./Services/Transformers/choppingLocations.json');
const lookupTable = JSON.parse(fs.readFileSync(lookupFilePath, 'utf-8'));

export const transformData = (responseData) => {
    // Ensure the responseData is an array
    const items = Array.isArray(responseData) ? responseData : [responseData];

    // Get current timestamp or use the provided timestamp
    const dateTime = new Date(responseData[0]?.timestamp || Date.now()).toISOString();

    // Filter the data into outputs and consumptions
    const outputItem = items.find(item => item.output === "1"); // Expecting one output entry
    const consumptionItems = items.filter(item => item.output === "0"); // All other items are consumption

    if (!outputItem) {
        throw new Error("No output entry found in the data");
    }

    // Lookup process details from your JSON-based lookup table
    const outputLocation = lookupTable[outputItem.item_code]||'2055';
    if (!outputLocation) {
        throw new Error(`Location for ItemNo ${outputItem.item_code} not found in lookup`);
    }

    // Generate the production order
    return {
        production_order_no: `${lookup.process_key}_${outputItem.chopping_id}`,
        ItemNo: outputItem.item_code,
        Quantity: parseFloat(outputItem.weight), // Output quantity
        uom: 'KG', // Default to "KG" if not provided
        LocationCode: outputLocation, // Use lookup to get location
        BIN: "", // Default batch number or empty
        user: "DefaultUser", // Default user ID
        line_no: 1000, // Line number for the output
        routing: "production_data_chopping_beheading.bc",
        date_time: dateTime,
        ProductionJournalLines: [
            // Output line
            {
                ItemNo: outputItem.item_code,
                Quantity: parseFloat(outputItem.weight),
                uom: 'KG', // Default to "KG"
                LocationCode: outputLocation, // Use lookup to get location
                BIN: "",
                line_no: 1000, // Line number for output
                type: "output",
                date_time: dateTime,
                user: "DefaultUser"
            },
            // Consumption lines
            ...consumptionItems.map((item, index) => {
                const consumptionLocation = lookupTable[item.item_code]||'2055'; // Lookup location for each consumption item
                if (!consumptionLocation) {
                    throw new Error(`Location for ItemNo ${item.item_code} not found in lookup`);
                }
                return {
                    ItemNo: item.item_code,
                    Quantity: parseFloat(item.weight),
                    uom: 'KG', // Default to "KG"
                    LocationCode: consumptionLocation, // Use lookup to get location
                    BIN: item.batch_no || "",
                    line_no: 2000 + index * 1000, // Increment line_no for each consumption
                    type: "consumption",
                    date_time: dateTime,
                    user: "DefaultUser"
                };
            })
        ]
    };
};
