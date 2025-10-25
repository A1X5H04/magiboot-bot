import { createLeaderBoardMessage } from "../lib/messages.ts";
import { getLeaderboardData } from "../services/leaderboard.ts";
import { AppContext } from "../types/bot.ts";

export async function handleLeaderboardCommand(ctx: AppContext) {
    try {
        await ctx.reply("⏳ Calculating leaderboard, please wait...");
        

        // 1. Fetch the data
        const leaderboardData = await getLeaderboardData(ctx.api);
        
        const message = createLeaderBoardMessage(leaderboardData);

        // 3. Send the reply
        await ctx.editMessageText(message.text, { 
            entities: message.entities,
            link_preview_options: { is_disabled: true}
        })
        
    } catch (err) {
        console.error("❌ Error in handleLeaderboardCommand:", err);
        await ctx.reply("An error occurred while fetching the leaderboard.");
    }
}