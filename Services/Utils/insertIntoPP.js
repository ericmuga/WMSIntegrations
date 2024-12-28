// import { getPool } from "./db"; // Adjust the path to your getPool implementation
import { getPool,dbConfigs } from "../../config/default.js";

export const pushToPickAndPack = async (payload) => {
  const pool = await getPool("pp"); // Replace with the appropriate database name
  
  try {
    // Begin transaction
    const transaction = pool.transaction();
    await transaction.begin();

    // Insert into orders table
    const orderQuery = `
      INSERT INTO [orders] (
        [order_no], [ended_by], [customer_no], [customer_name], [shp_code],
        [shp_name], [route_code], [sp_code], [sp_name], [shp_date],
        [assembler], [checker], [status], [ending_time], [ending_date],
        [ext_doc_no], [company_flag]
      ) VALUES (
        @order_no, @ended_by, @customer_no, @customer_name, @shp_code,
        @shp_name, @route_code, @sp_code, @sp_name, @shp_date,
        @assembler, @checker, @status, @ending_time, @ending_date,
        @ext_doc_no, @company_flag
      )
    `;

    const orderRequest = transaction.request();
    orderRequest.input("order_no", payload.order_no);
    orderRequest.input("ended_by", payload.ended_by);
    orderRequest.input("customer_no", payload.customer_no);
    orderRequest.input("customer_name", payload.customer_name);
    orderRequest.input("shp_code", payload.shp_code);
    orderRequest.input("shp_name", payload.shp_name);
    orderRequest.input("route_code", payload.route_code);
    orderRequest.input("sp_code", payload.sp_code);
    orderRequest.input("sp_name", payload.sp_name);
    orderRequest.input("shp_date", payload.shp_date);
    orderRequest.input("assembler", payload.assembler);
    orderRequest.input("checker", payload.checker);
    orderRequest.input("status", payload.status);
    orderRequest.input("ending_time", payload.ending_time);
    orderRequest.input("ending_date", payload.ending_date);
    orderRequest.input("ext_doc_no", payload.ext_doc_no);
    orderRequest.input("company_flag", payload.company_flag);

    await orderRequest.query(orderQuery);

    // Insert into lines table
    const lineQuery = `
      INSERT INTO [lines] (
        [order_no], [line_no], [item_no], [item_description], [customer_spec],
        [posting_group], [part], [order_qty], [ass_qty], [exec_qty], [assembler],
        [checker], [barcode], [qty_base]
      ) VALUES (
        @order_no, @line_no, @item_no, @item_description, @customer_spec,
        @posting_group, @part, @order_qty, @ass_qty, @exec_qty, @assembler,
        @checker, @barcode, @qty_base
      )
    `;

    for (const line of payload.lines) {
      const lineRequest = transaction.request();
      lineRequest.input("order_no", payload.order_no);
      lineRequest.input("line_no", line.line_no);
      lineRequest.input("item_no", line.item_no);
      lineRequest.input("item_description", line.item_description);
      lineRequest.input("customer_spec", line.customer_spec);
      lineRequest.input("posting_group", line.posting_group);
      lineRequest.input("part", line.part);
      lineRequest.input("order_qty", line.order_qty);
      lineRequest.input("ass_qty", line.ass_qty);
      lineRequest.input("exec_qty", line.exec_qty);
      lineRequest.input("assembler", line.assembler);
      lineRequest.input("checker", line.checker);
      lineRequest.input("barcode", line.barcode);
      lineRequest.input("qty_base", line.qty_base);

      await lineRequest.query(lineQuery);
    }

    // Commit transaction
    await transaction.commit();
    console.log("Order and lines inserted successfully.");
  } catch (error) {
    // Rollback transaction in case of error
    console.error("Error during insertion: ", error.message);
    if (pool.transaction) {
      await pool.transaction.rollback();
    }
  }
};

// Usage

// const dummyData={"order_no":"SO1101","ended_by":"","customer_no":"MM00165","customer_name":"ERIC THEURI MUGA","shp_code":"MM00165_MM","shp_name":"ERIC THEURI MUGA","route_code":"","sp_code":"034","sp_name":"RETAIL MOMBASA ROAD","shp_date":"2024-12-28","assembler":"","checker":"","status":4,"pda":false,"ending_time":"09:07:43.01","ending_date":"2024-12-28","ext_doc_no":"","company_flag":"","lines":[{"line_no":10000,"item_no":"J31010101","item_description":"Pork Chipolatas 200gms","customer_spec":"","posting_group":"JF-SAUSAGE","unit_of_measure":"PC","part":"B","order_qty":5,"ass_qty":0,"exec_qty":5,"assembler":"","checker":"","barcode":"","qty_base":0},{"line_no":20000,"item_no":"J31100102","item_description":"Beef Cubes, 500 gms","customer_spec":"","posting_group":"JF-FRES BE","unit_of_measure":"PC","part":"D","order_qty":5,"ass_qty":0,"exec_qty":5,"assembler":"","checker":"","barcode":"","qty_base":0}]}

// await pushToPickAndPack(dummyData);