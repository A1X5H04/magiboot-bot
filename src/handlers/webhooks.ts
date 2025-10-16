import { Api, Bot, RawApi } from "https://esm.sh/grammy";
import { safeParse } from "https://esm.sh/valibot";

import { AppContext } from "../types/bot.ts";
import { createBootanimationPost, createStatusMessage } from "../lib/messages.ts";
import { statusUpdateSchema } from "../schema/webhook-status.ts";
import { updateJobStatus } from "../services/queue.ts";
import { createPost } from "../services/post.ts";
import { TG_CHANNEL_LINK } from "../lib/constants.ts";

export default async function handleStatus(bot: Bot<AppContext, Api<RawApi>>, request: Request) {
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

        bot.api.sendVideo(TG_CHANNEL_LINK, validatedData.post_metadata.video.file_id, {
            reply_markup: {
                inline_keyboard: [[
                    { text: "⬇️ Download Module", url: validatedData.post_metadata.download_url }
                ]]
            },
            caption: postCaption.text,
            caption_entities: postCaption.entities
        })

        await createPost({
            user_id: validatedData.post_metadata.creator.user_id,
            download_url: validatedData.post_metadata.download_url,
            name: validatedData.post_metadata.title,
            message_id: validatedData.tg_metadata.messageId,
            unique_file_id: validatedData.post_metadata.video.file_unique_id
        })

        await updateJobStatus(validatedData.job_id, validatedData.status);
    }


    // Also update job status on failed
    if (validatedData.status === "failed") {
        await updateJobStatus(validatedData.job_id, validatedData.status);
    }

    return new Response("OK", { status: 200 });
}
