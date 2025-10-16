import type { Context, NextFunction } from "grammy";
import { createErrorMessage } from "../lib/messages.ts";


export async function handleBotErrors(ctx: Context, next: NextFunction) {
  try {
    await next();
  } catch (err) {
    console.error("❌ Bot middleware error:", err);
    try {
      const errMessage = createErrorMessage(err as Error)
      await ctx.reply(errMessage.text, { entities: errMessage.entities })
    } catch (sendErr) {
      console.error("Failed to send error message:", sendErr);
    }
  }
}
