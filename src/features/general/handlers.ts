import { b, bold, code, fmt, FormattedString, link } from "@grammyjs/parse-mode";
import { CustomContext } from "../../types/context";

export function handleStartCommand(ctx: CustomContext) {
    const message = FormattedString
    .bold("👋 Hello! I'm MagiBoot Bot \n")
    .plain("I'm here to help you create boot animations module for your device. Please use ")
    .code("/create")
    .plain("to start the process. \n\n").plain("To list available commands, use ")
    .code("/help")
    .plain(" and to find full guide about this bot, click ")
    .link("here.", "https://telegra.ph/Magiboot-BOT-Guide-08-11");
    

    ctx.reply(message.text, { entities: message.entities, link_preview_options: { is_disabled: true } })

}