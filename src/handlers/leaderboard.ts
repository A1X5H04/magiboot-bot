import { createLeaderBoardMessage } from "../lib/messages.ts";
import { getLeaderboardData } from "../services/leaderboard.ts";
import { AppContext } from "../types/bot.ts";

export async function handleLeaderboardCommand(ctx: AppContext) {
    try {
        const leaderboardData = await getLeaderboardData(ctx.api);
        
        const message = createLeaderBoardMessage(leaderboardData);

        await ctx.reply(message.text, { 
            entities: message.entities,
            link_preview_options: { is_disabled: true}
        })

    } catch (err) {
        console.error("❌ Error in handleLeaderboardCommand:", err);
        await ctx.reply("An error occurred while fetching the leaderboard.");
    }
}