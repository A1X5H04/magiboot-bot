import { Composer } from "grammy";
import { AppContext } from "../types/context";
import { handleGroupCreateCommand } from "../handlers/bootanimation";


const commandsComposer = new Composer<AppContext>()


// General Commands
commandsComposer.command("start", (ctx) => ctx.reply("You called start command."))
commandsComposer.command("help", (ctx) => ctx.reply("You called help command."))


// Public Commands

 
commandsComposer.command("b", handleGroupCreateCommand);

export default commandsComposer