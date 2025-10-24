import { Composer, Middleware } from "https://esm.sh/grammy";
import { AppContext } from "../types/bot.ts";
import { handleGroupCreateCommand } from "../handlers/bootanimation.ts";
import { autoQuote } from "https://deno.land/x/grammy_autoquote@v2.0.9/mod.ts";


const commandsComposer = new Composer<AppContext>()

// General Commands
commandsComposer.command("start", (ctx) => ctx.reply("You called start command."))
commandsComposer.command("help", (ctx) => ctx.reply("You called help command."))

// Group Commands
const commandComposerWithAutoReply = commandsComposer.use(autoQuote() as unknown as Middleware)
commandComposerWithAutoReply.command(["b", "bootanimation"], handleGroupCreateCommand);


export default commandsComposer