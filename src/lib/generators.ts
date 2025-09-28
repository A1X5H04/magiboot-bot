export const generateRandomId = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomId = '';
    for (let i = 0; i < 16; i++) {
        randomId += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return randomId;
}

export function createProgressBar(percentage: number, length: number = 10): string {
    const randomPercentageInRange = Math.floor(Math.random() * 16) + (percentage - 5);

    const clampedPercentage = Math.max(0, Math.min(100, randomPercentageInRange));
    const filledBlocks = Math.round((clampedPercentage / 100) * length);
    const emptyBlocks = length - filledBlocks;
  
    const filledEmoji = '🟩';
    const emptyEmoji = '◻️';
  
    const bar = filledEmoji.repeat(filledBlocks) + emptyEmoji.repeat(emptyBlocks);
    const percentageStr = `${clampedPercentage.toFixed(0)}%`;
    
    return `[${bar}] ${percentageStr}`;
  }
  