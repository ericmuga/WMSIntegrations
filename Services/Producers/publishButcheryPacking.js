
import { transformFn,runQueueWorkflow } from '../Utils/processQueueWorkflow.js';

const sourceTable = '[FCL-WMS].[calibra].[dbo].[idt_transfers]';
const queueTable = '[BOM].[dbo].[queue_status]';
const queueName = 'transfer_from_1570_to_3535';

const customParams = {
  location_code: ['3535'],
  transfer_from: '1570',

};
// export const publishButcheryPacking = () =>runQueueWorkflow(sourceTable, queueTable, queueName, customParams, undefined, transformFn);

const sourceTable2 = '[FCL-WMS].[calibra].[dbo].[idt_transfers]';
const queueTable2 = '[BOM].[dbo].[queue_status]';
const queueName2 = 'transfer_from_1570_to_3600';

const customParams2 = {
  location_code: ['3600'],
  transfer_from: '1570',

};
export const publishButcheryPacking = async() =>{
  runQueueWorkflow(sourceTable, queueTable, queueName, customParams, undefined, transformFn);

  runQueueWorkflow(sourceTable2, queueTable2, queueName2, customParams2, undefined, transformFn);
}


