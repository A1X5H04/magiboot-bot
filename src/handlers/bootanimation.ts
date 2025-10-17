import { AppContext } from "../types/bot.ts";
import { createDuplicatePostErrorMessage, createStatusMessage } from "../lib/messages.ts";
import { addJob } from "../services/queue.ts";
import { handleJob } from "../services/ci/orchestrator.ts";
import { getPostByNameOrUniqueId } from "../services/post.ts";
import { TG_GROUP_ID } from "../lib/constants.ts";
import { getUserInfo } from "../lib/helpers.ts";

export async function handleGroupCreateCommand(ctx: AppContext) {
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
  

    const file: { id: string | null; unique_id: string | null} = {
      id: null,
      unique_id: null
    }
  
    if (repliedMessage.video) {
      file.id = repliedMessage.video.file_id
      file.unique_id = repliedMessage.video.file_unique_id
    } else if (repliedMessage.document?.mime_type?.includes("video")) {
      file.id = repliedMessage.document.file_id
      file.unique_id = repliedMessage.document.file_unique_id
    }
  
    if (!file.id || !file.unique_id) {
      ctx.reply("Invalid video format, try again.")
      return;
    }

    const duplicatePost = await getPostByNameOrUniqueId(title as string, file.unique_id)

    if (duplicatePost) {
      const userInfo = await getUserInfo(ctx.api, TG_GROUP_ID, duplicatePost.user_id);

      const duplicatePostMessage = createDuplicatePostErrorMessage({ name: duplicatePost.name, message_id: duplicatePost.message_id, user: userInfo });

      ctx.reply(duplicatePostMessage.text, { entities: duplicatePostMessage.entities });
      return
    }    

    const statusMessage = createStatusMessage({ status: "pending", message: "Your request is queued for processing", progress: undefined})
    
    if (!ctx.chat?.id || !ctx.from?.id) {
      throw new Error("Cannot find chatID or UserId");
    }
    
    const message = await ctx.reply(statusMessage.text, { 
      entities: statusMessage.entities, 
      reply_parameters: {
        message_id: ctx.message?.message_id
      }
    })

    const job = await addJob({ 
      chatId: ctx.chat.id,
      creator: {
        id: ctx.from.id,
        name: ctx.from.first_name
      },
      statusMessageId: message.message_id, 
      videoFileId: file.id,
      uniqueFileId: file.unique_id, 
      title: title as string, 
      videoRefMessageId: repliedMessage.message_id
    })

    if (!job) {
      throw new Error("[Command: 'b'] No job was returned")
    }

    // Also send job to CI so it picks without needing to wait for the scheduler.
    await handleJob(job.id);
  }