
import { Api, Bot, RawApi } from "grammy";
import { safeParse } from "valibot";


import { ExtendedContext } from "../types/context";
import { createBootanimationPost, createStatusMessage } from "../lib/message";
import { statusUpdateSchema } from "../schema/webhook-status";

export default async function handleStatus(bot: Bot<ExtendedContext, Api<RawApi>>, request: Request) {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    const input = await request.json();

    const parseResult = safeParse(statusUpdateSchema, input);

    if (!parseResult.success) {
        return new Response("Invalid input schema:\n" + parseResult.issues.map((item) => item.message).join("\n"), { status: 400 });
    }

    const validatedData = parseResult.output;

    const statusString = createStatusMessage({
        message: validatedData.message,
        status: validatedData.status,
        progress: validatedData.status === "processing" ? validatedData.progress : undefined
    });

    await bot.api.editMessageText(
        validatedData.tg_metadata.chatId,
        validatedData.tg_metadata.messageId,
        statusString.text,
        { entities: statusString.entities }
    );

    if (validatedData.status === "completed") {
        const postCaption = createBootanimationPost(validatedData.post_metadata)

        bot.api.sendVideo("@testchannelmagiboot", validatedData.post_metadata.video.file_id, {
            reply_markup: {
                inline_keyboard: [[
                    { text: "⬇️ Download Module", url: validatedData.post_metadata.download_url }
                ]]
            },
            caption: postCaption.text,
            caption_entities: postCaption.entities
        })

    }

    return new Response("OK", { status: 200 });
}
