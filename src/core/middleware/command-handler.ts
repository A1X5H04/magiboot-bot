import { Composer } from "grammy";
import { CustomContext } from "../../types/context";

/**
 * This middleware preprocesses all incoming bot commands to manage conversational
 * flows (routes) and provide consistent feedback.
 *
 * It is responsible for:
 * 1.  Handling the global `/cancel` command to exit any active operation.
 * 2.  Gracefully interrupting an active operation when a new, valid command is received.
 * 3.  Filtering out and rejecting unknown commands before they reach other handlers.
 *
 * NOTE: This middleware IGNORES regular text messages and other media types,
 * allowing them to be processed by subsequent handlers.
 */
export const commandHandlerMiddleware = new Composer<CustomContext>();

// This middleware runs only for messages that are identified as bot commands.
commandHandlerMiddleware.on("::bot_command", async (ctx, next) => {
  // We can be certain `ctx.message.text` and `entities` exist due to the "::bot_command" filter.
  const text = ctx.message!.text!;
  
  // Robustly extract the primary command from the message.
  const commandEntity = ctx.message!.entities!.find(
    (e) => e.type === "bot_command" && e.offset === 0
  )!;
  const command = text.substring(1, commandEntity.length).split('@')[0].toLowerCase();
  
  const hasActiveRoute = Boolean(ctx.router?.path);

  // --- 1. Handle the global /cancel command ---
  // This command is fully handled here and does not proceed further.
  if (command === "cancel") {
    if (hasActiveRoute) {
      ctx.router.restart();
      ctx.form?.reset?.();
      await ctx.reply("✅ Operation cancelled.");
    } else {
      await ctx.reply("🤷 There's nothing to cancel right now.");
    }
    return; // Stop processing for the /cancel command.
  }

  const isValidCommand = ctx.hasCommand(command);

  console.log("isValidCommand", isValidCommand)

  // --- 2. Logic for when a route is active (command interruption) ---
  if (hasActiveRoute) {
    if (isValidCommand) {
      // A valid command interrupts the current flow.
      ctx.router.restart();
      ctx.form?.reset?.();
      await ctx.reply("↩️ Your previous operation was cancelled to start this new one.");
      // Allow the new valid command to be processed by its handler.
      return next();
    } else {
      // An invalid command was sent during a flow.
      await ctx.reply(
        "🤔 That command is unknown. Your current operation is still active. Use /cancel to stop it."
      );
      return; // Stop processing the unknown command.
    }
  }

  // --- 3. Logic for when no route is active (standard command handling) ---
  if (!isValidCommand) {
    await ctx.reply("❌ Unknown command. Use /help to see all available commands.");
    return; // Stop processing the unknown command.
  }

  // If the command is valid and no route is active, pass it to the next handler.
  return next();
});