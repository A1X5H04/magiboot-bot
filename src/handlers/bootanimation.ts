import { Document, Video } from "https://esm.sh/@grammyjs/types@3.22.2/message.d.ts";
import { FormattedString } from "https://esm.sh/@grammyjs/parse-mode@2.2.0";

import { addJob } from "../services/queue.ts";
import { handleJob } from "../services/ci/orchestrator.ts";
import { getPostByNameOrUniqueId } from "../services/post.ts";
import { TG_GROUP_ID } from "../lib/constants.ts";
import { getUserInfo } from "../lib/helpers.ts";
import { parseBootAnimConfig, runValidations, splitTitleAndConfig } from "../lib/utils.ts";
import { createDuplicatePostErrorMessage, createStatusMessage, createValidationErrorMessage } from "../lib/messages.ts";
import { checkBootAnimParts, checkDocumentMimeType, checkDuration, checkFileSize, checkIsPortrait, checkVideoMimeType } from "../lib/validators.ts";
import { AppContext } from "../types/bot.ts";
import { ValidationRule } from "../types/utils.ts";


export async function handleGroupCreateCommand(ctx: AppContext) {
  const repliedMessage = ctx.message?.reply_to_message
  const createArgs = ctx.match

  const bootAnimArgs = splitTitleAndConfig(createArgs as string);

  if (!repliedMessage) {
    await ctx.reply("You did not replied to any animation, try again.")
    return;
  }

  const repliedUserId = repliedMessage.from?.id
  const currentUserId = ctx.from?.id

  if (repliedUserId !== currentUserId) {
    await ctx.reply("Kanging another user's animation is bad idea!")
    return;
  }

  console.log("Boot Animation Arguments", bootAnimArgs);

  if (!bootAnimArgs) {
    const usageMessage = FormattedString.b("Invalid Arguments! ❌").plain("\n\n")
      .plain("Please provide your animation's name followed by the optional configuration parts. ")
      .plain("The name must be the first argument and enclosed in **double quotes** if it contains spaces.\n\n")
      .b("Required Format:\n")
      .code("/b \"<Animation Name>\" <config.part> <config.part> ...")
      .b("\n\nExamples:\n")
      .italic('- "Cool Animation" 3.loop end.play\n')
      .italic('- SimpleAnim 5.once 10.c.2.30\n\n')
      .b("Tip:").plain(" If your name is one word, quotes are optional.");

    await ctx.reply(usageMessage.text, { entities: usageMessage.entities });
    return
  }


  const file: { id: string | null; unique_id: string | null } = {
    id: null,
    unique_id: null
  }

  if (repliedMessage.video) {
    const rules: ValidationRule<Video>[] = [
      checkFileSize,
      checkDuration,
      checkIsPortrait,
      checkVideoMimeType,
    ];

    const errors = runValidations(repliedMessage.video, rules);

    if (errors.length > 0) {
      const validationErrMessage = createValidationErrorMessage(errors);
      return await ctx.reply(validationErrMessage.text,
        { entities: validationErrMessage.entities })
    }

    file.id = repliedMessage.video.file_id
    file.unique_id = repliedMessage.video.file_unique_id
  } else if (repliedMessage.document) {
    const rules: ValidationRule<Document>[] = [checkFileSize, checkDocumentMimeType];
    const errors = runValidations(repliedMessage.document, rules);

    if (errors.length > 0) {
      console.log("Errors", errors);
      const validationErrMessage = createValidationErrorMessage(errors);
      return await ctx.reply(validationErrMessage.text,
        { entities: validationErrMessage.entities })
    }

    file.id = repliedMessage.document.file_id
    file.unique_id = repliedMessage.document.file_unique_id
  } else {
    return await ctx.reply("Invalid video format, try again.")
  }

  const configErrors = runValidations(bootAnimArgs.config, [checkBootAnimParts])

  if (configErrors.length > 0) {
    const validationErrMessage = createValidationErrorMessage(configErrors);
    return await ctx.reply(validationErrMessage.text,
      { entities: validationErrMessage.entities })
  }

  const duplicatePost = await getPostByNameOrUniqueId(bootAnimArgs.title, file.unique_id)

  if (duplicatePost) {
    const userInfo = await getUserInfo(ctx.api, TG_GROUP_ID, duplicatePost.user_id);

    const duplicatePostMessage = createDuplicatePostErrorMessage({ name: duplicatePost.name, message_id: duplicatePost.message_id, user: userInfo });

    await ctx.reply(duplicatePostMessage.text, { entities: duplicatePostMessage.entities });
    return
  }

  const statusMessage = createStatusMessage({ status: "pending", message: "Your request is queued for processing", progress: undefined })

  if (!ctx.chat?.id || !ctx.from?.id) {
    throw new Error("Cannot find chatID or UserId");
  }

  const message = await ctx.reply(statusMessage.text, {
    entities: statusMessage.entities
  })

  console.log("JOB Metadata", {
    message: {
      chatId: ctx.chat.id,
      messageId: message.message_id,
    },
    creator: {
      id: ctx.from.id,
      name: ctx.from.first_name
    },
    file_id: file.id,
    unique_file_id: file.unique_id,
    title: bootAnimArgs.title,
    video_ref_message_id: repliedMessage.message_id,
    bootanim_config: parseBootAnimConfig(bootAnimArgs.config)
  })

  const job = await addJob({
    message: {
      chatId: ctx.chat.id,
      messageId: message.message_id,
    },
    creator: {
      id: ctx.from.id,
      name: ctx.from.first_name
    },
    file_id: file.id,
    unique_file_id: file.unique_id,
    title: bootAnimArgs.title,
    video_ref_message_id: repliedMessage.message_id,
    bootanim_config: parseBootAnimConfig(bootAnimArgs.config)
  })

  if (!job) {
    throw new Error("[Command: 'b'] No job was returned")
  }

  // Also send job to CI so it picks without needing to wait for the scheduler.
  await handleJob(job.id);
}