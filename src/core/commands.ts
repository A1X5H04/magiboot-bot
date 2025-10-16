import { Composer } from "https://esm.sh/grammy";
import { AppContext } from "../types/bot.ts";
import { handleGroupCreateCommand } from "../handlers/bootanimation.ts";


const commandsComposer = new Composer<AppContext>()

// General Commands
commandsComposer.command("start", (ctx) => ctx.reply("You called start command."))
commandsComposer.command("help", (ctx) => ctx.reply("You called help command."))

// Public Commands
commandsComposer.command("bootanimation", handleGroupCreateCommand);

export default commandsComposer