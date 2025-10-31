import { Api, Bot, RawApi } from "https://esm.sh/grammy";
import { FormattedString } from "https://esm.sh/@grammyjs/parse-mode@2.2.0";
import { safeParse } from "https://esm.sh/valibot";

import { AppContext } from "../types/bot.ts";
import { createBootanimationPost } from "../lib/messages.ts";
import { statusUpdateSchema } from "../schema/webhook-status.ts";

import { TG_CHANNEL_ID } from "../lib/constants.ts";
import { createTursoClient } from "../lib/turso.ts";
import { updateStatus  } from "../repositories/queue.ts";
import { create as createPost } from "../repositories/post.ts";

export default async function handleStatus(bot: Bot<AppContext, Api<RawApi>>, request: Request) {
    const db = createTursoClient();

    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    const input = await request.json();
    console.log("WebHook Status Request: ", input);

    const parseResult = safeParse(statusUpdateSchema, input);

    if (!parseResult.success) {
        return new Response("Invalid input schema:\n" + parseResult.issues.map((item) => item.message).join("\n"), { status: 400 });
    }

    const validatedData = parseResult.output;
    let statusMessage: FormattedString;

    
    switch (validatedData.status) {
        case "processing":
            await updateStatus(db, validatedData.job_id, "processing");
            statusMessage = FormattedString.b("🔧 Processing: ")
                .plain("Your boot animation is currently being handled by a worker.")
                .plain("\nIt’ll be ready shortly and automatically ")
                .b("posted to the channel ").plain("once completed.");
            break;
        case "failed":
            await updateStatus(db, validatedData.job_id, "failed");
            statusMessage = FormattedString.b("❌ Failed: ")
                .plain(validatedData.message || "Something went wrong while processing your boot animation.")
                .plain("\nPlease try again later or upload a new video.")
                .italic("\n\nDetails:\n")
                .plain(validatedData.error_list?.join("\n• ") || "")
            break;
        case "completed": {
            const postCaption = createBootanimationPost(validatedData.post_metadata)

            const res = await bot.api.sendAnimation(TG_CHANNEL_ID, validatedData.post_metadata.preview_url || validatedData.post_metadata.video.file_id, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: "⬇️ Download Module", url: validatedData.post_metadata.download_url }
                    ]]
                },
                caption: postCaption.text,
                caption_entities: postCaption.entities
            })
    
            await createPost(db, {
                user_id: validatedData.post_metadata.creator.user_id,
                download_url: validatedData.post_metadata.download_url,
                name: validatedData.post_metadata.title,
                message_id: res.message_id,
                unique_file_id: validatedData.post_metadata.video.file_unique_id,
                tags: validatedData.post_metadata.tags
            })
            await updateStatus(db, validatedData.job_id, validatedData.status);

            statusMessage = FormattedString.b("✅ Completed: ")
            .plain("Your boot animation has been successfully processed.")
            .plain("\nIt’s now posted on the channel — check it out here:")
            .plain("👉 ")
            .link(validatedData.post_metadata.title, `https://t.me/${TG_CHANNEL_ID}/${res.message_id}`)
            break;
        }

        case "pending":
            await updateStatus(db, validatedData.job_id, "pending")
            statusMessage = FormattedString.b("⏳ Pending: ")
            .plain("Your boot animation is in the queue and will be picked up soon.")
            .plain("\nIt’ll start processing as soon as a worker is available.")
            break;

        default:
            console.error("Unknown status received:", validatedData);
            return new Response("Unknown status", { status: 400 });
    }

    await bot.api.editMessageText(
        validatedData.tg_metadata.chatId,
        validatedData.tg_metadata.messageId,
        statusMessage.text,
        { 
            entities: statusMessage.entities,
            link_preview_options: { is_disabled: true }
        }
    );

    return new Response("OK", { status: 200 });
}
