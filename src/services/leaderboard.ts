import { Api, RawApi } from "https://esm.sh/grammy";
import { createTursoClient } from "../lib/turso.ts";
import * as postRepo from "../repositories/post.ts";
import { getUserInfo } from "../lib/helpers.ts";
import { TG_GROUP_ID } from "../lib/constants.ts";
import { TGUserInfo } from "../types/bot.ts";

const db = createTursoClient();

export interface LeaderboardEntry {
    rank: number;
    user: TGUserInfo;
    total_posts: number;
    total_votes: number;
    total_downloads: number;
    score: number;
}

function calculateScore(total_votes: number, total_downloads: number): number {
    return (Math.max(0, total_votes * 2)) + (total_downloads * 1);
}

export async function getLeaderboardData(api: Api<RawApi>): Promise<LeaderboardEntry[]> {

    const userStats = await postRepo.groupByUserId(db);
    if (!userStats) {
        return [];
    }

    const userInfoPromises = userStats.map(stat => 
        getUserInfo(api, TG_GROUP_ID, stat.user_id)
    );
    const userInfos = await Promise.all(userInfoPromises);

    // 3. Combine stats and user info, then calculate scores
    const combinedData = userStats.map((stat, index) => {
        return {
            ...stat,
            user: userInfos[index], // Match stat[i] with userInfo[i]
            score: calculateScore(stat.total_votes, stat.total_downloads)
        };
    }).filter(stat => stat.score > 0);

    const sortedData = combinedData.sort((a, b) => b.score - a.score);

    return sortedData.map((data, index) => ({
        ...data,
        rank: index + 1
    }));
}