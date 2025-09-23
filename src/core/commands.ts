import { Composer } from "grammy";
import { CustomContext } from "../types/context";
import {  handleGroupCreateCommand } from "../features/bootanimation/handlers";
import { handleStartCommand } from "../features/general/handlers";

const commandsComposer = new Composer<CustomContext>()


// General Commands
commandsComposer.command("start", handleStartCommand)
commandsComposer.command("help", (ctx) => ctx.reply("You called help command."))


// Bootanimation Commands 
commandsComposer.command("b", handleGroupCreateCommand);

export default commandsComposer