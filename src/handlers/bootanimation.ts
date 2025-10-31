import { Document, Video } from "https://esm.sh/@grammyjs/types@3.22.2/message.d.ts";
import { FormattedString } from "https://esm.sh/@grammyjs/parse-mode@2.2.0";

import { handleJob } from "../services/ci/orchestrator.ts";
import { ALLOWED_CATEGORIES, TG_GROUP_ID } from "../lib/constants.ts";
import { getUserInfo } from "../lib/helpers.ts";
import { parseBootAnimConfig, parseCommandArgs, runValidations } from "../lib/utils.ts";
import { createDuplicatePostErrorMessage, createValidationErrorMessage } from "../lib/messages.ts";
import { checkBootAnimParts, checkDocumentMimeType, checkDuration, checkFileSize, checkIsPortrait, checkVideoMimeType } from "../lib/validators.ts";
import { AppContext } from "../types/bot.ts";
import { ValidationRule } from "../types/utils.ts";
import * as postRepositories from "../repositories/post.ts"
import { create as addJob } from "../repositories/queue.ts"
import { createTursoClient } from "../lib/turso.ts";


export async function handleGroupCreateCommand(ctx: AppContext) {
  const db = createTursoClient();

  const repliedMessage = ctx.message?.reply_to_message
  const createArgs = ctx.match

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


  const bootAnimArgs = parseCommandArgs(createArgs as string);
  console.log("Boot Animation Arguments", bootAnimArgs);

  if (!bootAnimArgs || !bootAnimArgs.title || bootAnimArgs.tags.length <= 0) {
    const usageMessage = FormattedString.b("Invalid Arguments! ❌").plain("\n\n")
      .plain("Please provide your animation's name, at least one category tag, and optional config parts.\n")
      .plain("The name must be the first argument and enclosed in **double quotes** if it contains spaces.\n\n")
      .b("Required Format:\n")
      .code("/b \"<Animation Name>\" <category> <config.part> <config.part> ...")
      .b("\n\nExamples:\n")
      .italic('- "Cool Animation" #minimal #abstrack 3.loop end.play\n')
      .italic('- SimpleAnim #anime 5.once 10.c.2.30\n\n')
      .b("Tip:").plain(" If your name is one word, quotes are optional.");

    await ctx.reply(usageMessage.text, { entities: usageMessage.entities });
    return
  }

  const validTags = bootAnimArgs.tags.filter(tag => ALLOWED_CATEGORIES.has(tag));

  if (validTags.length === 0) {
    const errorMsg = FormattedString.b("No Valid Category! 🏷️").plain("\n\n")
      .plain("You must provide at least one valid category tag.\n\n")
      .b("Your tags: ")
      .plain(bootAnimArgs.tags.map(t => `#${t}`).join(' ') || "(None)")
      .plain("\n")
      .b("Available: \n")
      .code(Array.from(ALLOWED_CATEGORIES)
        .map(c => `#${c}`)
        .join(', '));

    return await ctx.reply(errorMsg.text, { entities: errorMsg.entities });
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

  const duplicatePost = await postRepositories.findByNameOrUniqueFileId(db, bootAnimArgs.title, file.unique_id)

  if (duplicatePost) {
    const userInfo = await getUserInfo(ctx.api, TG_GROUP_ID, duplicatePost.user_id);

    const duplicatePostMessage = createDuplicatePostErrorMessage({ name: duplicatePost.name, message_id: duplicatePost.message_id, user: userInfo });

    await ctx.reply(duplicatePostMessage.text, { entities: duplicatePostMessage.entities });
    return
  }

  const statusMessage = FormattedString.b("⏳ Pending: ")
    .plain("Your boot animation is in the queue and will be picked up soon.")
    .plain("\nIt’ll start processing as soon as a worker is available.")

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
    bootanim_config: parseBootAnimConfig(bootAnimArgs.config),
    tags: validTags
  })

  const job = await addJob(db, {
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
    bootanim_config: parseBootAnimConfig(bootAnimArgs.config),
    tags: validTags
  })

  if (!job) {
    throw new Error("[Command: 'b'] No job was returned")
  }

  // Also send job to CI so it picks without needing to wait for the scheduler.
  await handleJob(job.id);

}