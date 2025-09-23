import { FormattedString } from "@grammyjs/parse-mode";
import { CustomContext } from "../../types/context";
import { createProgressBar } from "../../core/lib/utils";
import { addToQueue } from "../../services/queue";


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

    const formattedString = new FormattedString("Your request is queued for processing.")
    .plain(`\n\n⏳ ${createProgressBar(0)}\n\n`).italic("\nDo not delete this message, you will get updates here.")

    const message = await ctx.reply(formattedString.text, { entities: formattedString.entities })

    // await addToQueue(ctx, { statusMessageId: message.message_id, videoFileId: fileId, title: title as string })
}






// export function handleCreateCommand(ctx: CustomContext) {
  
//   const title = ctx.match


//   if (!title) {
//     const message = new FormattedString("Invalid command argument, please use ")
//     .code("/create <title>")
//     .plain(" to create a bootanimation.")

//     ctx.reply(message.text, { entities: message.entities })
//     return;
//   }

//   const message = FormattedString.b(`🎬 Send the video for the bootanimation '${title}'?\n\n`)
//     .plain("Validations: \n")
//     .plain("1. Must be maximum 20s long.\n")
//     .plain("2. Must be at most 25 MB in size.\n")
//     .plain("3. Must be of 60fps or less.\n\n")
//     .italic("Tip: You can always cancel the process by sending")
//     .code("/cancel")
//     .plain(".")

//   ctx.form.set("title", title);
//   ctx.router.push("bootanimation:create:getVideo");
//   ctx.reply(message.text, { entities: message.entities });
// }


// export async function handleGetVideo(ctx: Filter<CustomContext, "msg:document" | "msg:video">) {
//   let fileId: string | undefined

//   if (ctx.message?.video) {
//     fileId = ctx.message.video.file_id
//   } else if (ctx.message?.document?.mime_type?.includes("video")) {
//     fileId = ctx.message.document.file_id
//   }

//   if (!fileId) {
//     const invalidMessage = new FormattedString("🤔 That doesn't look like a video. Please try again or send ")
//     .code("/cancel")
//     .plain(" to cancel.")

//     ctx.reply(invalidMessage.text, { entities: invalidMessage.entities })
//     return;
//   }

//   ctx.form.set("fileId", fileId)

//   const message = FormattedString.b(`🎬 Video received!\n\n`)
//     .bold("Status: ").plain("⏳ Queued. You are currently in position ").code("1").plain(".\n\n")
//     .italic("Do not delete this message, you will get updates here.")
    
//   ctx.reply(message.text, { entities: message.entities })

// }