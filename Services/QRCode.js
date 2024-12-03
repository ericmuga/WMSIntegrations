export const  generateResponse=()=> {
    const currentDateTime = new Date().toISOString(); // Get current date-time in ISO format
    const mtn = generateMtn(); // Generate unique MTN
    const verificationUrl = `https://itax.kra.go.ke/KRA-Portal/invoiceChk.htm?actionCode=loadPage&invoiceNo=${mtn}`; // Construct verification URL
    const totalAmount = (Math.random() * 100000).toFixed(2); // Random total amount
    const totalItems = Math.floor(Math.random() * 100) + 1; // Random total items (1-100)
    const msn = `KRAMW${mtn.slice(-6)}202207057777`; // Construct MSN using MTN
    
    return {
        DateTime: currentDateTime,
        invoiceExtension: "TAX INVOICE",
        mtn: mtn,
        verificationUrl: verificationUrl,
        messages: "Success",
        totalAmount: parseFloat(totalAmount),
        totalItems: totalItems,
        msn: msn
    };
}

// Helper function to generate a unique MTN
export const  generateMtn=()=> {
    const prefix = "009057777"; // Fixed prefix for MTN
    const uniquePart = Date.now().toString().slice(-10); // Use current timestamp's last 10 digits
    const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, "0"); // Random 4-digit suffix
    return `${prefix}${uniquePart}${randomPart}`;
}

