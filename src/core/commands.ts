import { Composer, Middleware } from "https://esm.sh/grammy";
import { autoQuote } from "https://deno.land/x/grammy_autoquote@v2.0.9/mod.ts";

import { AppContext } from "../types/bot.ts";
import { handleGroupCreateCommand } from "../handlers/bootanimation.ts";
import { handleLeaderboardCommand } from "../handlers/leaderboard.ts";
import { handlePopularCommand, handleTrendingCommand } from "../handlers/ranking.ts";


const commandsComposer = new Composer<AppContext>()

// General Commands
commandsComposer.command("start", (ctx) => ctx.reply("You called start command."))
commandsComposer.command("help", (ctx) => ctx.reply("You called help command."))
commandsComposer.command("leaderboard", handleLeaderboardCommand)
commandsComposer.command("popular", handlePopularCommand)
commandsComposer.command("trending", handleTrendingCommand)

// Group Commands
const commandComposerWithAutoReply = commandsComposer.use(autoQuote() as unknown as Middleware)
commandComposerWithAutoReply.command(["b", "bootanimation"], handleGroupCreateCommand);


export default commandsComposer