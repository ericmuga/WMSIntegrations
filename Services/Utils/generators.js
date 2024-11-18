export function generateProductionOrderNo() {
    const prefix = "PX0_";
    const randomNumber = Math.floor(10000 + Math.random() * 90000); // Generates a random 5-digit number
    const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // Generates a random uppercase letter (A-Z)
    return `${prefix}${randomNumber}${randomLetter}`;
}