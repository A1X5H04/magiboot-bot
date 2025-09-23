export function createProgressBar(percentage: number, length: number = 10): string {
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const filledBlocks = Math.round((clampedPercentage / 100) * length);
  const emptyBlocks = length - filledBlocks;

  const filledEmoji = '🟩';
  const emptyEmoji = '◻️';

  const bar = filledEmoji.repeat(filledBlocks) + emptyEmoji.repeat(emptyBlocks);
  const percentageStr = `${clampedPercentage.toFixed(0)}%`;
  
  return `${percentageStr} [${bar}]`;
}
