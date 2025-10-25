// src/handlers/reactions.ts
import { Filter } from "https://esm.sh/grammy";
import { AppContext } from "../types/bot.ts";
import { TG_CHANNEL_ID } from "../lib/constants.ts"; // Make sure TG_CHANNEL_ID is exported
import { createTursoClient } from "../lib/turso.ts";
import * as postRepo from "../repositories/post.ts";

const UPVOTES = new Set(['❤️', '😍', '👍', '🔥', '👏', '🤩', '🤯']);
const DOWNVOTES = new Set(['🤬', '😡', '👎', '💩', '🤮', '🤡', '🥴', '😐']);

const db = createTursoClient();

export async function handleReactionCounts(ctx: Filter<AppContext, "message_reaction_count">) {
    console.log("Handle Message Reaction got called!", ctx.messageReactionCount.chat.id);
    try {
        const reactionCount = ctx.messageReactionCount;
        const chat_id = reactionCount.chat.id;
        
        if (String(chat_id) !== TG_CHANNEL_ID) {
            console.error("Chat ID another than channel ID");
            return;
        }

        const message_id = reactionCount.message_id;

        const post = await postRepo.findByMessageId(db, message_id);
        if (!post) {
            // Not a post we track, ignore.
            return;
        }

        let net_score = 0

        for (const reaction of reactionCount.reactions) {
            if (reaction.type.type === "emoji") {
                if (UPVOTES.has(reaction.type.emoji)) {
                    net_score += reaction.total_count;
                } else if (DOWNVOTES.has(reaction.type.emoji)) {
                    net_score -= reaction.total_count;
                }
            }
        }

        await postRepo.updateVoteScore(db, post.id, net_score);

        console.log(`[VoteUpdate] Post ${post.id} (Msg ${message_id}) new net score: ${net_score}`);
    } catch (err) {
        console.error("❌ Error in handleMessageReaction:", err);
    }
}