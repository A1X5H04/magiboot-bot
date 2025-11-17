import { FormattedString } from "https://esm.sh/@grammyjs/parse-mode@2.2.0";
import { AppContext } from "../types/bot.ts";

export async function handlePrivateChat(ctx: AppContext) {
    const greetingMessage = FormattedString.b("👋 Hi, I am Magiboot bot.\nI'll help you create bootanimation module from a video.")
        .plain("\n\nUnfortunately, I don't talk to strangers in private.\nTo create bootanimation modules for your own video, join the @magibootchat group, and @magiboot channel where I post bootanimations modules using videos send by users.\n\n")
        .italic("For more information on how to use me click ")
        .link("here", "https://telegra.ph/Magiboot-BOT-Guide-08-11")

    await ctx.reply(greetingMessage.text, { entities: greetingMessage.entities, link_preview_options: { is_disabled: true } })
}

export async function handleStartCommand(ctx: AppContext) {
    const message = FormattedString
        .b("🚀 Magiboot Bot")
        .plain("\nSend me a video and I’ll generate a bootanimation module for it.\n\n")
        .plain("For details and options, use the /help command.");

    await ctx.reply(message.text, { entities: message.entities });

}

export async function handleHelpCommand(ctx: AppContext) {
    const helpMessage = FormattedString
        .b("Magiboot Bot — Bootanimation Builder")
        .plain("\n\nSend me a video and I'll convert it into a flashable bootanimation module.\n\n")
        .b("Tips:")
        .plain("\n• Short videos export faster\n• Keep resolution reasonable for smoother results\n• I'll guide you if something is wrong with the input\n\n")
        .italic("Full usage guide: ")
        .link("Magiboot BOT Guide", "https://telegra.ph/Magiboot-BOT-Guide-08-11");

    await ctx.reply(helpMessage.text, { entities: helpMessage.entities, link_preview_options: { is_disabled: true } })
}