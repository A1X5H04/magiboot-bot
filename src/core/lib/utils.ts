import { BotContext } from '../../types/cloudflare';

export function isCommand(text: string, command: string): boolean {
  return text.startsWith(`/${command}`) || text.startsWith(`/${command}@`);
}

export function getCommandArgs(text: string): string {
  return text.split(' ').slice(1).join(' ').trim();
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
}

export async function replyWithError(ctx: BotContext, error: unknown): Promise<void> {
  const errorMessage = formatError(error);
  await ctx.reply(`❌ Error: ${errorMessage}`);
}
