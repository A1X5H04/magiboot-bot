import { CustomContext } from "../types/context";
import { createStatusMessage } from "../lib/message";
import { addJobtoQueue } from "../services/ci/queue";
import { handleJob } from "../services/ci/orchestrator";

export async function handleGroupCreateCommand(ctx: CustomContext) {
  const repliedMessage = ctx.message?.reply_to_message
  const title = ctx.match
  
    if (!repliedMessage) {
      ctx.reply("You did not replied to any video, try again.")
      return;
    }
  
    if (!title) {
      ctx.reply("You did not provide a title, try again.")
      return;
    }
  
    let fileId: string | undefined
  
    if (repliedMessage.video) {
      fileId = repliedMessage.video.file_id
    } else if (repliedMessage.document?.mime_type?.includes("video")) {
      fileId = repliedMessage.document.file_id
    }
  
    if (!fileId) {
      ctx.reply("Invalid video format, try again.")
      return;
    }

    const statusMessage = createStatusMessage({ status: "pending", message: "Your request is queued for processing", progress: undefined})
    
    if (!ctx.chat?.id || !ctx.from?.id) {
      ctx.reply("Internal error, please try again.")
      return;
    }
    
    const message = await ctx.reply(statusMessage.text, { 
      entities: statusMessage.entities, 
      reply_parameters: {
        message_id: ctx.message?.message_id
      }
    })

    const { jobId } = await addJobtoQueue(ctx.env, { 
      chatId: ctx.chat.id,
      creator: {
        id: ctx.from.id,
        name: ctx.from.first_name
      },
      statusMessageId: message.message_id, 
      videoFileId: fileId, 
      title: title as string, 
      videoRefMessageId: repliedMessage.message_id
    })

    // Also send job to CI so it picks without needing to wait for the scheduler.
    await handleJob(ctx.env, jobId);
}