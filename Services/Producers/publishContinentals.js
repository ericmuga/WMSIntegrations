
import { transformFn,runQueueWorkflow } from '../Utils/processQueueWorkflow.js';

const sourceTable = '[FCL-WMS].[calibra].[dbo].[idt_transfers]';
const queueTable = '[BOM].[dbo].[queue_status]';
const queueName = 'continentals.bc';

const customParams = {
  location_code: ['3600', '3535'],
  transfer_from: '2595',
  productCodeRanges: [
    { rangeStart: 'J31010101', rangeEnd: 'J31019199' },
    { rangeStart: 'J31030101', rangeEnd: 'J31032199' },
  ],
};

runQueueWorkflow(sourceTable, queueTable, queueName, customParams, undefined, transformFn);
