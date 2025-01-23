
import { transformFn,runQueueWorkflow } from '../Utils/processQueueWorkflow.js';

const sourceTable = '[FCL-WMS].[calibra].[dbo].[idt_transfers]';
const queueTable = '[BOM].[dbo].[queue_status]';
const queueName = 'transfer_from_1570_to_2055';

const customParams = {
  location_code: ['2055'],
  transfer_from: '1570',
//   productCodeRanges: [
//     { rangeStart: 'J31010101', rangeEnd: 'J31019199' },
//     { rangeStart: 'J31030101', rangeEnd: 'J31032199' },
//   ],
};
export const publishMincing = () =>runQueueWorkflow(sourceTable, queueTable, queueName, customParams, undefined, transformFn);
