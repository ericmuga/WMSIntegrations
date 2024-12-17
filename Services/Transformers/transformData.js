import { fetchProcessForOutputItem, fetchBOMData } from '../Utils/utilities.js';
import { processSequenceHandler } from './processHandler.js';
import logger from '../../logger.js';
import { v4 as uuidv4 } from 'uuid';
// import {processConfig} from '../Consumers/processConfig.js';

/**
 * Transforms transfer data into production orders.
 *
 * @param {Object} transferData - The data for the transfer.
 * @param {Array} sequence - The sequence of processes to follow.
 * @returns {Array} - The generated production orders in reverse order.
 */
export const transformData = async (transferData, finalProcess) => {
    try {
        const {
            product_code,
            receiver_total_weight,
            id,
            timestamp,
        } = transferData;

        const dateTime = new Date(timestamp).toISOString();
        const user = 'wms_bc';

        // Dynamically resolve the Process for the initial product_code
        const initialProcess = await fetchProcessForOutputItem(product_code);
        if (!initialProcess) {
            logger.error(`No Process found for product_code: ${product_code}`);
            return [];
        }

        // Fetch BOM data for the initial Process
        const initialBOM = await fetchBOMData(initialProcess, product_code);
        if (!initialBOM.length) {
            logger.error(`No BOM data found for Process: ${initialProcess} and output_item: ${product_code}`);
            return [];
        }

        const batchMultiplier = receiver_total_weight / parseFloat(initialBOM[0].batch_size);
       

        // Process the sequence of operations
        const productionOrders = await processSequenceHandler({
            initialItem: product_code,
            batchMultiplier,
            user,
            dateTime,
            id,
            finalProcess
        });

        // Reverse the order of production orders
        return productionOrders.reverse();
    } catch (error) {
        logger.error(`Error generating production orders: ${error.message}`);
        return [];
    }
};


// const mockDataForProductCodes = (productCodes, processName) => {
//     const mockedData = productCodes.map((productCode, index) => ({
//         product_code: productCode,
//         transfer_from_location: Math.floor(Math.random() * 1000) + 2000, // Random location between 2000-2999
//         transfer_to_location: Math.floor(Math.random() * 1000) + 3000,   // Random location between 3000-3999
//         receiver_total_pieces: Math.floor(Math.random() * 500) + 1,      // Random pieces between 1-500
//         receiver_total_weight: (Math.random() * 100).toFixed(2),         // Random weight up to 100 kg
//         received_by: Math.floor(Math.random() * 100) + 1,                // Random receiver ID between 1-100
//         production_date: new Date().toISOString(),                       // Current date as production date
//         timestamp: new Date().toISOString().replace('T', ' ').split('.')[0], // Current timestamp in 'YYYY-MM-DD HH:mm:ss' format
//         id: index + 1,                                                   // Incremental ID
//         company_name: 'FCL',
//         process_name: processName,                                       // Additional process name
//     }));

//     return mockedData;
// };

/**
 * Transforms the mocked data into a usable format.
 * @param {Object} inputData - Input JSON data.
 * @param {string} processName - Name of the process.
 * @returns {Object} - Transformed data.
 */


// Example product codes (mocking the SQL result)
// const productCodes = ['J31010803','J31010804','J31010807','J31011309','J31011315','J31015805','J31015810','J31015812','J31015820','J31015824','J31019129','J31020101','J31020102','J31020103','J31020113','J31020121','J31020122','J31020123','J31020201','J31020202','J31020301','J31020302','J31020402','J31020501','J31020502','J31020601','J31020602','J31020603','J31020608','J31020611','J31020612','J31020613','J31020620','J31020621','J31020622','J31020702','J31020705','J31020711','J31020802','J31020803','J31020811','J31020851','J31020901','J31020902','J31020903','J31021001','J31021002','J31021003','J31021021','J31021022','J31021023','J31021101','J31021301','J31021302','J31021304','J31022101','J31022210','J31022211','J31022851','J31030102','J31030106','J31030201','J31030202','J31030221','J31030222','J31030601','J31030602','J31030651','J31030652','J31030655','J31030701','J31030702','J31030801','J31030802','J31030804','J31030820','J31030901','J31030902','J31030925','J31030928','J31030929','J31030941','J31030942','J31031002','J31031003','J31031004','J31031005','J31031101','J31031104','J31031202','J31031205','J31031301','J31031302','J31031401','J31031403','J31031502','J31031503','J31031504','J31031560','J31031702','J31031702','J31031706','J31031710','J31031716','J31031726','J31031802','J31031803','J31031804','J31031806','J31031813','J31031816','J31031818','J31031821','J31040101','J31040103','J31040203','J31040403','J31040404','J31040410','J31040411','J31040415','J31040502','J31040601','J31040801','J31040803','J31040905','J31041010','J31050101','J31050203','J31050204','J31050206','J31050210','J31050213','J31050407','J31050501','J31050503','J31050601','J31050603','J31050604','J31050605','J31050701','J31050801','J31050902','J31050905','J31051301','J31051302','J31051401','J31060101','J31060103','J31060104','J31060201','J31065101','J31065103','J31065201','J31070101','J31070102','J31070103','J31090264','K35040127','K35165178','K35165181','K35165183','K35165187','K35165189','K35165193','K35165201'];

//     const processAllProductCodes = async (productCodes, processName) => {
//         const results = [];
    
//         for (const productCode of productCodes) {
//             const mockedData = {
//                 product_code: productCode,
//                 transfer_from_location: Math.floor(Math.random() * 1000) + 2000, // Random location between 2000-2999
//                 transfer_to_location: Math.floor(Math.random() * 1000) + 3000,   // Random location between 3000-3999
//                 receiver_total_pieces: Math.floor(Math.random() * 500) + 1,      // Random pieces between 1-500
//                 receiver_total_weight: (Math.random() * 100).toFixed(2),         // Random weight up to 100 kg
//                 received_by: Math.floor(Math.random() * 100) + 1,                // Random receiver ID between 1-100
//                 production_date: new Date().toISOString(),                       // Current date as production date
//                 timestamp: new Date().toISOString().replace('T', ' ').split('.')[0], // Current timestamp in 'YYYY-MM-DD HH:mm:ss' format
//                 id: uuidv4(),                                                    // Unique ID using UUID
//                 company_name: 'FCL',
//                 process_name: processName,                                       // Additional process name
//             };
    
//             // Call transformData with the mocked data
//             try {
//                 const transformedData = await transformData(mockedData, processName);
//                 results.push(transformedData);
//             } catch (error) {
//                 console.error(`Error processing product code ${productCode}:`, error.message);
//             }
//         }
    
//         return results;
//     };

// await processAllProductCodes(productCodes, 'Beheading');
// // Example usage
// const jsonData = ` {
//   "product_code": "J31020612",
//   "transfer_from_location": 2595,
//   "transfer_to_location": "3535",
//   "receiver_total_pieces": "250",
//   "receiver_total_weight": "100",
//   "received_by": 82,
//   "production_date": "2024-12-03T21:00:00.000000Z",
//   "timestamp": "2024-12-04 01:18:38",
//   "id": 44,
//   "company_name": "FCL"
// }`;

// (async () => {
//     try {
//         const data = await transformData(JSON.parse(jsonData),'Beheading');
//         // logger.info(`transfer: ${JSON.stringify(JSON.parse(jsonData), null, 2)}`); // Pretty-print the output
//         logger.info(`Orders: ${JSON.stringify(data, null, 2)}`); // Pretty-print the output
//         // logger.info(`Orders: ${JSON.stringify(data, null, 2)}`); // Pretty-print the output
//     } catch (error) {
//         logger.error('Error:', error.message);
//     }
// })();


