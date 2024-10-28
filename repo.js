// repo.js

export const customers = [
    {
      cust_no: "240",
      customer_name: "Naivas Limited",
      ship_to_array: [
        { shp_no: "001", ship_to_name: "Naivas Limited" },
        { shp_no: "002", ship_to_name: "Naivas - Kitui" }
      ]
    },
    {
      cust_no: "258",
      customer_name: "Naivas Limited - Deli",
      ship_to_array: [
        { shp_no: "003", ship_to_name: "Naivas-Elgon View Eldoret" },
        { shp_no: "004", ship_to_name: "Naivas- Lavington" }
      ]
    },
    {
      cust_no: "404",
      customer_name: "Chandarana Supermarkets Ltd",
      ship_to_array: [
        { shp_no: "005", ship_to_name: "Chandarana - Yaya" },
        { shp_no: "006", ship_to_name: "Chandarana - Adlife Plaza" }
      ]
    },
    {
      cust_no: "420",
      customer_name: "Quickmart Supermarkets-CHILLER",
      ship_to_array: [
        { shp_no: "007", ship_to_name: "Quick Mart - Ruai" },
        { shp_no: "008", ship_to_name: "Quick Mart - Westfield Lavington" }
      ]
    },
    {
      cust_no: "823",
      customer_name: "Quickmart Limited-BUTCHERY",
      ship_to_array: [
        { shp_no: "009", ship_to_name: "Quick Mart - Ruai" },
        { shp_no: "010", ship_to_name: "Quick Mart - Westfield Lavington" }
      ]
    },
    {
      cust_no: "824",
      customer_name: "Quickmart Limited-DELI",
      ship_to_array: [
        { shp_no: "011", ship_to_name: "Quick Mart - Ruai" },
        { shp_no: "012", ship_to_name: "Quick Mart - Westfield Lavington" }
      ]
    },
    {
      cust_no: "913",
      customer_name: "Majid Al Futtaim Hypermarkets Ltd-CHILLER A/C",
      ship_to_array: [
        { shp_no: "013", ship_to_name: "Carrefour - Two Rivers" },
        { shp_no: "014", ship_to_name: "Carrefour - Nextgen" }
      ]
    },
    {
      cust_no: "914",
      customer_name: "Majid Al Futtaim Hypermarkets Ltd-DELI/FRESH A/C",
      ship_to_array: [
        { shp_no: "015", ship_to_name: "Carrefour - Two Rivers" },
        { shp_no: "016", ship_to_name: "Carrefour - Nextgen" }
      ]
    }
  ];
  
  export const items = [
    { item_code: "J31010101", description: "Pork Chipolatas 200gms", unit_of_measure: "PC" },
    { item_code: "J31010102", description: "Pork Chipolatas 1kg", unit_of_measure: "PC" },
    { item_code: "J31015501", description: "Beef Sausage Catering 1Kg", unit_of_measure: "PC" },
    { item_code: "J31031702", description: "Beef Smokies Labless 1Kg", unit_of_measure: "PC" },
    { item_code: "J31031706", description: "Beef Smokies, 400gms Ex long", unit_of_measure: "PC" }
  ];
  
  export const locations = [
    {
      code: "3535",
      bins: []
    },
    {
      code: "3600",
      bins: []
    }];

    export const salesPersons = [
        { sp_code: "012", name: "Retail City Center I", customer_no: "", default_location: "3535" },
        { sp_code: "013", name: "Retail City Center II", customer_no: "", default_location: "3535" },
        { sp_code: "019", name: "Direct Sales", customer_no: "90000", default_location: "3535" },
        { sp_code: "021", name: "Thika Shop", customer_no: "96279", default_location: "3625" },
        { sp_code: "022", name: "Market Returns sales code", customer_no: "", default_location: "3626" },
        // Add more sales persons as needed
      ];


      export const vendors = [
        { no: "PF99901", name: "Rosemark - Kamiti" },
        { no: "PF99902", name: "Rosemark - Uplands I" },
        { no: "PF99903", name: "Rosemark - Uplands II" },
        { no: "PF99904", name: "Rosemark - Oasis" },
        { no: "PF99905", name: "Rosemark - Multiplication Unit" },
        { no: "PF99906", name: "Rosemark - Kimeria Farm" },
        { no: "PF99907", name: "Rosemark - Karen Pig Unit" }
      ];
      
  
  