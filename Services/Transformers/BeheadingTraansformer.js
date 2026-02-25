import { TransformerInterface } from './transformerInterface.js';
import { getProcessDetails } from '../lookup.js';

export class BeheadingTransformer extends TransformerInterface {
  transform(data) {
    const processDetails = getProcessDetails(data.process_code);
    const dateTime = new Date(data.timestamp).toISOString();

    return {
      production_order_no: `${processDetails.production_order_series}_${data.id}`,
      ItemNo: data.item_code,
      Quantity: parseFloat(data.total_weight),
      uom: 'KG',
      LocationCode: processDetails.output_location,
      user: data.user_id || 'WMS_BC',
      date_time: dateTime,
      ProductionJournalLines: [
        {
          ItemNo: data.item_code,
          Quantity: parseFloat(data.total_weight),
          uom: 'KG',
          LocationCode: processDetails.output_location,
          line_no: 1000,
          type: 'output',
          user: 'WMS_BC',
          date_time: dateTime,
        },
        {
          ItemNo: processDetails.intake_item,
          Quantity: parseFloat(data.total_weight) / (1 - processDetails.process_loss),
          uom: 'KG',
          LocationCode: processDetails.input_location,
          line_no: 2000,
          type: 'consumption',
          user: 'WMS_BC',
          date_time: dateTime,
        }
      ]
    };
  }
}
