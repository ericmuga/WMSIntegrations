
import { transformFn,runQueueWorkflow } from '../Utils/processQueueWorkflow.js';

const sourceTable = '[FCL-WMS].[calibra].[dbo].[idt_transfers]';
const queueTable = '[BOM].[dbo].[queue_status]';
const queueName = 'sausages.bc';

const customParams = {
  location_code: ['3600', '3535'],
  transfer_from: '2055',
}

export const publishSausage = () =>runQueueWorkflow(sourceTable, queueTable, queueName, customParams, undefined, transformFn);
