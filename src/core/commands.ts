import { Composer } from "grammy";
import { CustomContext } from "../types/context";
import { handleGroupCreateCommand } from "../handlers/bootanimation";


const commandsComposer = new Composer<CustomContext>()


// General Commands
commandsComposer.command("start", (ctx) => ctx.reply("You called start command."))
commandsComposer.command("help", (ctx) => ctx.reply("You called help command."))


// Bootanimation Commands 
commandsComposer.command("b", handleGroupCreateCommand);

export default commandsComposer