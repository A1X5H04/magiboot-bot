import { FormattedString } from "@grammyjs/parse-mode";
import { CustomContext } from "../../types/context";
import { Filter } from "grammy";
import { QueueService } from "../../core/lib/queue";

export function handleCreateCommand(ctx: CustomContext) {
  const message = FormattedString.b("🎬 Please send me the video you want to convert.\n\n")
    .plain("I'll take it from there! If you change your mind, just send ")
    .code("/cancel")
    .plain(".");

  ctx.router.push("bootanimation:create:getVideo");
  ctx.reply(message.text, { entities: message.entities });
}


export async function handleGetVideo(ctx: Filter<CustomContext, "msg:document" | "msg:video">) {
  let fileId: string | undefined

  if (ctx.message?.video) {
    fileId = ctx.message.video.file_id
  } else if (ctx.message?.document?.mime_type?.includes("video")) {
    fileId = ctx.message.document.file_id
  }

  if (!fileId) {
    const invalidMessage = new FormattedString("🤔 That doesn't look like a video. Please try again or send ")
    .code("/cancel")
    .plain(" to cancel.")

    ctx.reply(invalidMessage.text, { entities: invalidMessage.entities })
    return;
  }

  const statusMessage = await ctx.reply("⏳ Your job is being added to the queue...")

  const job = await QueueService.add(ctx, { chatId: ctx.chat.id, statusMessageId: statusMessage.message_id, videoFileId: fileId })

  const confirmation = FormattedString.b("✅ Job queued!\n\n")
    .plain("Your Job ID is ")
    .code(job.jobId)
    .plain(". You'll get updates here.\n\n")
    .b("Please DON'T delete this message!")

  ctx.api.editMessageText(ctx.chat.id, statusMessage.message_id, confirmation.text, { entities: confirmation.entities })

}