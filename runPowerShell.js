import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Full path to the PowerShell script
const scriptPath = path.join(process.cwd(), 'curlCall.ps1');

// Function to run the PowerShell script with an increased maxBuffer size
const runPowerShellScript = async () => {
  try {
    // Increase maxBuffer to handle larger output
    const { stdout, stderr } = await execPromise(`powershell -ExecutionPolicy Bypass -File ${scriptPath}`, { maxBuffer: 1024 * 1024 * 50 }); // 10MB buffer

    if (stderr) {
      console.error(`PowerShell error: ${stderr}`);
    } else {
      console.log(`PowerShell Output:\n${stdout}`);
    }
  } catch (error) {
    console.error(`Error executing PowerShell script: ${error.message}`);
  }
};

// Call the function to execute the PowerShell script
runPowerShellScript();
