// src/handlers/reactions.ts
import { Filter } from "https://esm.sh/grammy";
import { AppContext } from "../types/bot.ts";
import { TG_CHANNEL_ID } from "../lib/constants.ts"; // Make sure TG_CHANNEL_ID is exported
import { createTursoClient } from "../lib/turso.ts";
import * as postRepo from "../repositories/post.ts";
import * as voteRepo from "../repositories/post_votes.ts";

const UPVOTES = new Set(['❤️', '😍', '👍', '🔥', '👏', '🤩', '🤯']);
const DOWNVOTES = new Set(['🤬', '😡', '👎', '💩', '🤮', '🤡', '🥴', '😐']);

const db = createTursoClient();

export async function handleMessageReaction(ctx: Filter<AppContext, "message_reaction">) {
    try {
        const reaction = ctx.messageReaction;
        const chat_id = reaction.chat.id;
        
        if (String(chat_id) !== TG_CHANNEL_ID) {
            return;
        }

        const message_id = reaction.message_id;
        const user_id = reaction.user?.id

        if (!user_id) {
            console.error("[Handler:Reaction] Failed to get the user id");
            return;
        }

        // 2. Find the post in our database
        const post = await postRepo.findByMessageId(db, message_id);
        if (!post) {
            // Not a post we track, ignore.
            return;
        }

        // 3. Determine the new vote value
        const hasUpvote = reaction.new_reaction.filter(r => r.type === "emoji").some(r => UPVOTES.has(r.emoji))
        const hasDownvote = reaction.new_reaction.filter(r => r.type === "emoji").some(r => DOWNVOTES.has(r.emoji))

        let final_vote = 0;
        if (hasUpvote && !hasDownvote) {
            final_vote = 1; // User has one or more upvotes, but no downvotes
        } else if (!hasUpvote && hasDownvote) {
            final_vote = -1; // User has one or more downvotes, but no upvotes
        }

        await voteRepo.upsertUserVote(db, post.id, user_id, final_vote);


        console.log(`[Vote] User ${user_id} voted ${final_vote} on Post ${post.id}.`);
    } catch (err) {
        console.error("❌ Error in handleMessageReaction:", err);
    }
}