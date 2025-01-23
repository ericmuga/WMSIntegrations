import { publishBeheadingData, 
         publishBreakingData,
            publishDeboningData, 
         publishCarcassSalesData, 
         publishChoppingData,
        //  publishButcheryPacking,
       } from "./queryWMSData.js";
import logger from "../../logger.js";
import { publishButcheryPacking } from "./publishButcheryPacking.js";
import { publishMincing } from "./publishMincing.js";
import { publishSausage} from "./publishSausage.js";
import { publishContinentals} from "./publishContinentals.js";

const mainPublisher =(async ()=>{

  try{
         publishCarcassSalesData();
         publishBeheadingData ();
         publishBreakingData();
         publishDeboningData();
        //  publishButcheryPacking();
        //  publishMincing(); 
        //  publishChoppingData();
        //  publishSausage();
        //  publishContinentals();

}catch(error){
      logger.error(`Error: ${error.message}`);
    }
});

// const startJob = () => {
  // setInterval(async () => {
    // logger.info('Starting mainPublisher job...');
    await mainPublisher();
  // }, 1 * 60 * 1000); // 30 minutes in milliseconds
// };

// Start the job
// startJob();
