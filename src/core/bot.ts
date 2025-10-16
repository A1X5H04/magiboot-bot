import { Bot } from 'https://esm.sh/grammy';
import commandsComposer from "./commands.ts";
import { handleBotErrors } from "../middleware/handle-error.ts";
import { privateMessageMiddleware } from "../middleware/private-message.ts";

function initBot() {
    const botToken = Deno.env.get("BOT_TOKEN")
    const botInfo = Deno.env.get("BOT_INFO")

    if (!botToken || !botInfo) {
        throw new Error("Missing credentials (BOT_TOKEN or BOT_INFO)");
    }

    const bot = new Bot(botToken, { botInfo: JSON.parse(botInfo) });

    bot.on("message", privateMessageMiddleware);
    bot.use(handleBotErrors)
    bot.use(commandsComposer)

    return bot;
}

export { initBot }
