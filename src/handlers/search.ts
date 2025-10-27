import { AppContext } from "../types/bot.ts";
import { createTursoClient } from "../lib/turso.ts";
import { getUserInfo } from "../lib/helpers.ts";
import { TG_GROUP_ID } from "../lib/constants.ts";
import { createRankedPostsMessage, EnrichedRankedPost } from "../lib/messages.ts";
import * as postRepo from "../repositories/post.ts";



/**
 * Parses the search query to find tags and text.
 */
function parseSearchQuery(query: string): { tags: string[]; text: string } {
    const tagRegex = /#\w+/g;
    const tags = (query.match(tagRegex) || [])
        .map(tag => tag.substring(1).toLowerCase());
    
    const text = query.replace(tagRegex, "").trim();
    
    return { tags, text };
}

export async function handleSearchCommand(ctx: AppContext) {
    if (!ctx.chat) return;
    const db = createTursoClient();

    const query = (ctx.match as string || "").trim();

    if (!query) {
        await ctx.reply("Please provide a search term or tags.\n\nUsage:\n`/search Pixel`\n`/search #anime #sci-fi`");
        return;
    }

    const { tags, text } = parseSearchQuery(query);

    let posts: postRepo.RankedPost[] | null = null;
    let title: string;

    try {
        if (tags.length > 0 && !text) {
            // --- Tag-only Search ---
            title = `Results for ${tags.map(t => `#${t}`).join(' ')}`;
            posts = await postRepo.searchPostsByTags(db, tags);
        } else {
            // --- Name Search ---
            // (We use the full query string for name search, including any '#'
            // if the user mixes them, for a simpler fuzzy search)
            title = `Results for "${query}"`;
            posts = await postRepo.searchPostsByName(db, query);
        }

        
        if (!posts) {
            await ctx.reply(`No boot animations found for "${query}".`);
            return;
        }

        
        const creatorInfos = await Promise.all(
            posts.map(post => getUserInfo(ctx.api, TG_GROUP_ID, post.user_id))
        );

        
        const enrichedPosts: EnrichedRankedPost[] = posts.map((post, index) => ({
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
        console.error("❌ Error in /search command:", err);
        await ctx.reply("An error occurred during the search. Please try again.");
    }
}