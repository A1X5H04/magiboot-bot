import { FormattedString } from "https://esm.sh/@grammyjs/parse-mode@2.2.0";
import { AppContext } from "../types/bot.ts";

export async function handlePrivateChat(ctx: AppContext) {
    const greetingMessage = FormattedString.b("👋 Hi, I am Magiboot bot.\nI'll help you create bootanimation module from a video.")
    .plain("\n\nUnfortunately, I don't talk to strangers in private.\nTo create bootanimation modules for your own video, join the @magibootchat group, and @magiboot channel where I post bootanimations modules using videos send by users.\n\n")
    .italic("For more information on how to use me click ")
    .link("here", "https://telegra.ph/Magiboot-BOT-Guide-08-11")

    await ctx.reply(greetingMessage.text, { entities: greetingMessage.entities, link_preview_options: { is_disabled: true } })
}