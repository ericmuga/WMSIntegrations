export function generateProductionOrderNo() {
    const prefix = "PX0_";
    const randomNumber = Math.floor(10000 + Math.random() * 90000); // Generates a random 5-digit number
    const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // Generates a random uppercase letter (A-Z)
    return `${prefix}${randomNumber}${randomLetter}`;
}

export function transformData(input) {
    return [
        {
            production_order_no:generateProductionOrderNo(),
            Quantity: parseFloat(input.receiver_total_weight),
            ItemNo: input.product_code,
            uom: "KG",

            LocationCode: input.transfer_from_location.toString(),
            BIN: "",
            user: "77",
            line_no: 1000,
            routing: "production_order.bc",
            date_time: input.production_date,
            ProductionJournalLines: [
                {
                    ItemNo: input.product_code,
                    Quantity: parseFloat(input.receiver_total_weight),
                    uom: "KG",
                    // LocationCode: input.transfer_to_location.toString(),
                    LocationCode: "1020",
                    BIN: "",
                    line_no: 1000,
                    type: "output",
                    date_time: input.production_date,
                    user: "77"
                },
                {
                    ItemNo: "G0110",  // Assuming a fixed ItemNo for consumption, adjust as needed
                    Quantity: parseFloat(input.receiver_total_weight),   // Assuming a fixed quantity for consumption, adjust as needed
                    uom: "KG",
                    LocationCode: "1020",  // Assuming a fixed location for consumption, adjust as needed
                    BIN: "",
                    line_no: 2000,
                    type: "consumption",
                    date_time: input.production_date,
                    user: "77"
                }
            ]
        },
        {
            production_order_no: generateProductionOrderNo(),
            Quantity: parseFloat(input.receiver_total_weight),
            // ItemNo: input.product_code,
            ItemNo: "J31090157",
            uom: "KG",
            LocationCode: input.transfer_to_location.toString(),
            BIN: "",
            user: "77",
            line_no: 1000,
            routing: "production_order.bc",
            date_time: input.production_date,
            ProductionJournalLines: [
                {
                    ItemNo: "J31090157",
                    Quantity: parseFloat(input.receiver_total_weight),
                    uom: "KG",
                    LocationCode: input.transfer_to_location.toString(),
                    BIN: "",
                    line_no: 1000,
                    type: "output",
                    date_time: input.production_date,
                    user: "77"
                },
                {
                    ItemNo: input.product_code,  // Assuming a fixed ItemNo for consumption, adjust as needed
                    Quantity: parseFloat(input.receiver_total_weight),   // Assuming a fixed quantity for consumption, adjust as needed
                    uom: "KG",
                    LocationCode: "1020",  // Assuming a fixed location for consumption, adjust as needed
                    BIN: "",
                    line_no: 2000,
                    type: "consumption",
                    date_time: input.production_date,
                    user: "77"
                },
                {
                    ItemNo: "H224655",  // Assuming a fixed ItemNo for consumption, adjust as needed
                    Quantity: parseFloat(input.receiver_total_weight)*0.025                    ,   // Assuming a fixed quantity for consumption, adjust as needed
                    uom: "PC",
                    LocationCode: "1505",  // Assuming a fixed location for consumption, adjust as needed
                    BIN: "",
                    line_no: 2000,
                    type: "consumption",
                    date_time: input.production_date,
                    user: "77"
                },
                {
                    ItemNo: "H225002",  // Assuming a fixed ItemNo for consumption, adjust as needed
                    Quantity: parseFloat(input.receiver_total_weight)*0.0015                    ,   // Assuming a fixed quantity for consumption, adjust as needed
                    uom: "KG",
                    LocationCode: "1505",  // Assuming a fixed location for consumption, adjust as needed
                    BIN: "",
                    line_no: 2000,
                    type: "consumption",
                    date_time: input.production_date,
                    user: "77"
                }
            ]
        }
    ];

}

