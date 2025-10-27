import { AppContext } from "../types/bot.ts";
import { createTursoClient } from "../lib/turso.ts";
import { getUserInfo } from "../lib/helpers.ts";
import { TG_GROUP_ID } from "../lib/constants.ts";
import { createRankedPostsMessage } from "../lib/messages.ts";
import * as postRepo from "../repositories/post.ts";


const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Reusable core logic for fetching and sending ranked posts.
 */
async function sendRankedPosts(
    ctx: AppContext,
    period: 'all_time' | 'trending'
) {
    if (!ctx.chat) return;
    const db = createTursoClient();

    const titles = {
        all_time: "🔥 Most Popular (All Time)",
        trending: "📈 Trending This Week"
    };
    const title = titles[period];
    const sinceDate = (period === 'trending')
        ? new Date(Date.now() - ONE_WEEK_MS).toISOString()
        : null;

    try {
        const posts = await postRepo.getRankedPosts(db, sinceDate, 10);

        if (!posts || posts.length <= 0) {
            await ctx.reply("No posts found for this category yet!");
            return;
        }

        const creatorInfos = await Promise.all(
            posts.map(post => getUserInfo(ctx.api, TG_GROUP_ID, post.user_id))
        );
        
        const enrichedPosts = posts.map((post, index) => ({
            ...post,
            rank: index + 1,
            creator: creatorInfos[index]
        }));

        
        const message = createRankedPostsMessage(enrichedPosts, title);
        await ctx.reply(message.text, {
            entities: message.entities,
            link_preview_options: { is_disabled: true }
        });

    } catch (err) {
        console.error(`❌ Error in ${period} command:`, err);
        await ctx.reply("An error occurred while fetching posts. Please try again.");
    }
}

// Public handlers
export const handlePopularCommand = (ctx: AppContext) => 
    sendRankedPosts(ctx, 'all_time');
    
export const handleTrendingCommand = (ctx: AppContext) => 
    sendRankedPosts(ctx, 'trending');