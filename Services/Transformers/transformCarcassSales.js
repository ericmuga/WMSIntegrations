const  transformDateToInteger=(dateString)=> {
    // Parse the date string and get the timestamp in milliseconds
    const date = new Date(dateString);
    return Math.floor(date.getTime());
}



const lookup = {
    routing: "beheading-sales",
    user: "EMUGA",
    wip_input_location:"1020",
    wip_uom:"KG",
    wip_output_location:"1570",
    wip_intake_item:"G0110",
    wip_output_item:"G1033",
    wip_return_item:"G1030",
    wip_process_loss:0.02,
    
    fg_uom:"KG",
    fg_input_location:"1570",
    fg_output_location:"3535",
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

const roundTo2Decimals = (num) => {
    return Math.round(num * 100) / 100;
}
    const resolvePackagingMaterials = (totalWeight) => {
        return lookup.packaging_materials.map((material, index) => ({
            ItemNo: material.item,
            Quantity: roundTo2Decimals(totalWeight * material.process_loss), // Calculate quantity based on process loss
            uom: material.uom,
            LocationCode: material.location,
            BIN: "",
            line_no: 3000 + index * 10, // Assign line numbers dynamically
            type: "consumption",
            date_time: responseData.timestamp,
            user: 'WMS_BC',
        }));
    };

    const suffix = (responseData.receiver_total_weight>0)?"-wip":"-fg";
  const mainProductionOrder = 
        {
            
            production_order_no: lookup.production_order_series + "_" + order_no +suffix,
            Quantity: Math.abs(parseFloat(responseData.receiver_total_weight)),
            ItemNo: (responseData.receiver_total_weight>0)?lookup.wip_output_item:lookup.wip_return_item,
            uom: lookup.wip_uom,
            LocationCode:lookup.wip_output_location,
            BIN: "",
            user: 'WMS_BC',
            line_no: 1000,
            routing: lookup.routing,
            date_time: responseData.timestamp,
            ProductionJournalLines: [
                {
                    ItemNo: (responseData.receiver_total_weight>0)?lookup.wip_output_item:lookup.wip_return_item,
                    Quantity:Math.abs(parseFloat(responseData.receiver_total_weight)),
                    uom: lookup.wip_uom,
                    LocationCode: lookup.wip_output_location,
                    BIN: "",
                    line_no: 1000,
                    type: "output",
                    date_time: responseData.timestamp,
                    user: 'WMS_BC',
                },
                {
                    ItemNo: (responseData.receiver_total_weight>0)?lookup.wip_intake_item:lookup.fg_output_item,
                    Quantity: Math.abs(parseFloat(responseData.receiver_total_weight)),
                    uom: lookup.wip_uom,
                    LocationCode:(responseData.receiver_total_weight>0)?lookup.wip_input_location:lookup.fg_output_location,
                    BIN: "",
                    line_no: 2000,
                    type: "consumption",
                    date_time: responseData.timestamp,
                    user: 'WMS_BC',
                },
            ],
        };

    const additionalProductionOrder =


        {
            production_order_no: lookup.production_order_series + "_" + order_no + "-fg",
            Quantity: parseFloat(responseData.receiver_total_weight),
            ItemNo: lookup.fg_output_item,
            uom: lookup.fg_uom,
            LocationCode: lookup.fg_output_location,
            BIN: "",
            user: 'WMS_BC',
            line_no: 1000,
            routing: lookup.routing,
            date_time: responseData.timestamp,
            ProductionJournalLines: [
                {
                    ItemNo: lookup.fg_output_item,
                    Quantity: parseFloat(responseData.receiver_total_weight),
                    uom: lookup.fg_uom,
                    LocationCode: responseData.transfer_to_location.toString(),
                    BIN: "",
                    line_no: 1000,
                    type: "output",
                    date_time: responseData.timestamp,
                    user: 'WMS_BC',
                },
                {
                    ItemNo: lookup.wip_output_item,
                    Quantity: parseFloat(responseData.receiver_total_weight),
                    uom: lookup.wip_uom,
                    LocationCode: lookup.wip_output_location,
                    BIN: "",
                    line_no: 2000,
                    type: "consumption",
                    date_time: responseData.timestamp,
                    user: 'WMS_BC',
                },
                ...resolvePackagingMaterials(parseFloat(responseData.receiver_total_weight)), // Add dynamically resolved packaging materials
            ]
        };
        
        if (responseData.receiver_total_weight>0){
            return [mainProductionOrder, additionalProductionOrder];
        }
        else{
            return [mainProductionOrder];
        }
    

};

