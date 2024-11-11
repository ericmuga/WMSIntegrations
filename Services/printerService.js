// printerService.js

import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

export const printInit = (data) => {
    // Process incoming data and generate print files
    console.log("--------------------------printing--------------------")
    console.log(data)

    // Initialize printing
    // print()
} 

const print = () => {
    // Resolve __dirname in ES module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Define the folder paths
    const folderPath = path.resolve(__dirname, '../pdf');
    const printedFolderPath = path.resolve(__dirname, '../printed');

    // Ensure the "printed" directory exists
    if (!fs.existsSync(printedFolderPath)) {
        fs.mkdirSync(printedFolderPath);
    }

    console.log("Folder path:", folderPath);
    console.log("Printed folder path:", printedFolderPath);

    // Read files in the folder
    fs.readdir(folderPath, (err, files) => {
        if (err) {
            console.error(`Error reading folder: ${err.message}`);
            return;
        }

        // Loop through each file
        files.forEach((file) => {
            const filePath = path.join(folderPath, file);
            const printedFilePath = path.join(printedFolderPath, file);

            // Check if it's a file (not a directory)
            if (fs.statSync(filePath).isFile()) {
                // Use print command to send the file to the default printer
                exec(`print /D:"HP LaserJet Pro M404-M405 PCL-6 (V4)" "${filePath}"`, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error printing ${file}: ${error.message}`);
                    } else if (stderr) {
                        console.error(`Error printing ${file}: ${stderr}`);
                    } else {
                        console.log(`Print job for ${file} sent successfully.`);

                        // Move the file to the "printed" folder after printing
                        fs.rename(filePath, printedFilePath, (moveErr) => {
                            if (moveErr) {
                                console.error(`Error moving ${file} to printed folder: ${moveErr.message}`);
                            } else {
                                console.log(`${file} has been moved to the printed folder.`);
                            }
                        });
                    }
                });
            }
        });
    });
}
