const  transformDateToInteger=(dateString)=> {
    // Parse the date string and get the timestamp in milliseconds
    const date = new Date(dateString);
    return Math.floor(date.getTime());
}

const lookup = {
    routing: "production_order.bc",
    user: "EMUGA",
    wip_input_location:"1020",
    wip_uom:"KG",
    wip_output_location:"1570",
    wip_intake_item:"G0110",
    wip_output_item:"G1033",
    wip_process_loss:0.02,
    
    fg_uom:"KG",
    fg_input_location:"1570",
    fg_output_location:"1570",
    fg_intake_item:"G1033",
    fg_output_item:"J31090157",
    fg_process_loss:0.00,
    production_order_series:"P00",
    packaging_materials:[
        {
            item:"H224655",
            process_loss:0.025,
            location:"1505",
            uom:"PC"
        },
        {
            item:"H225002",
            process_loss:0.0015,
            location:"1505",
            uom:"KG"
        }
    ]
    
    
}


export const transformData = (responseData) => {
    const dateTime = new Date(responseData.timestamp).toISOString() || new Date().toISOString(); // Get current timestamp for date_time
    const order_no = responseData.id ? responseData.id.toString() : transformDateToInteger(responseData.timestamp);

    const resolvePackagingMaterials = (totalWeight) => {
        return lookup.packaging_materials.map((material, index) => ({
            ItemNo: material.item,
            Quantity: totalWeight * material.process_loss, // Calculate quantity based on process loss
            uom: material.uom,
            LocationCode: material.location,
            BIN: "",
            line_no: 3000 + index * 10, // Assign line numbers dynamically
            type: "consumption",
            date_time: responseData.production_date,
            user: lookup.user,
        }));
    };

    return [
        {
            production_order_no: lookup.production_order_series + "_" + order_no + "-wip",
            Quantity: parseFloat(responseData.receiver_total_weight),
            ItemNo: lookup.wip_output_item,
            uom: lookup.wip_uom,
            LocationCode: lookup.wip_output_location,
            BIN: "",
            user: lookup.user,
            line_no: 1000,
            routing: lookup.routing,
            date_time: responseData.production_date,
            ProductionJournalLines: [
                {
                    ItemNo: responseData.product_code,
                    Quantity: parseFloat(responseData.receiver_total_weight),
                    uom: lookup.wip_uom,
                    LocationCode: lookup.wip_output_location,
                    BIN: "",
                    line_no: 1000,
                    type: "output",
                    date_time: responseData.production_date,
                    user: lookup.user,
                },
                {
                    ItemNo: lookup.wip_intake_item,
                    Quantity: parseFloat(responseData.receiver_total_weight),
                    uom: lookup.wip_uom,
                    LocationCode: lookup.wip_input_location,
                    BIN: "",
                    line_no: 2000,
                    type: "consumption",
                    date_time: responseData.production_date,
                    user: lookup.user,
                },
            ],
        },
        {
            production_order_no: lookup.production_order_series + "_" + order_no + "-fg",
            Quantity: parseFloat(responseData.receiver_total_weight),
            ItemNo: lookup.fg_output_item,
            uom: lookup.fg_uom,
            LocationCode: lookup.fg_output_location,
            BIN: "",
            user: lookup.user,
            line_no: 1000,
            routing: lookup.routing,
            date_time: responseData.production_date,
            ProductionJournalLines: [
                {
                    ItemNo: lookup.fg_output_item,
                    Quantity: parseFloat(responseData.receiver_total_weight),
                    uom: lookup.fg_uom,
                    LocationCode: responseData.transfer_to_location.toString(),
                    BIN: "",
                    line_no: 1000,
                    type: "output",
                    date_time: responseData.production_date,
                    user: lookup.user,
                },
                {
                    ItemNo: responseData.product_code,
                    Quantity: parseFloat(responseData.receiver_total_weight),
                    uom: lookup.wip_uom,
                    LocationCode: lookup.wip_input_location,
                    BIN: "",
                    line_no: 2000,
                    type: "consumption",
                    date_time: responseData.production_date,
                    user: lookup.user,
                },
                ...resolvePackagingMaterials(parseFloat(responseData.receiver_total_weight)), // Add dynamically resolved packaging materials
            ],
        },
    ];
};