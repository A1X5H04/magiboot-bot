import { TursoClient } from "../lib/turso.ts";
import { mapToModel } from "../lib/utils.ts";
import { PostModel } from "../types/models.ts";

type GroupByUserIdResults = {
    user_id: number;
    total_posts: number;
    total_votes: number;
    total_downloads: number;
}

type PostForSync = Pick<PostModel, "id" | "name" | "download_count">;
export type RankedPost = Pick<
    PostModel, 
    "id" | "name" | "user_id" | "message_id" | "download_count" | "votes" | "tags"
>;

export async function create(client: TursoClient, data: Pick<PostModel, "user_id" | "message_id" | "name" | "unique_file_id" | "download_url"> & { tags: string[] }) {

    const tagsJSON = JSON.stringify(data.tags);

    const rs = await client.execute({
        sql: "INSERT INTO posts (user_id, message_id, name, unique_file_id, download_url, tags) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        args: [data.user_id, data.message_id, data.name, data.unique_file_id, data.download_url, tagsJSON]
    })

    if (rs.rows.length === 0) {
            return null;
    }
    
    return mapToModel<Pick<PostModel, "id">>(rs.rows[0])
}


export async function findByNameOrUniqueFileId(client: TursoClient, name: string, unique_file_id: string) {
    const rs = await client.execute({
        sql: "SELECT name, message_id, user_id FROM posts WHERE name = ? OR unique_file_id = ?",
        args: [name, unique_file_id]
    });

    if (rs.rows.length === 0) {
        return null
    }

    return mapToModel<Pick<PostModel, "name" | "message_id" | "user_id">>(rs.rows[0]);
}

export async function groupByUserId(client: TursoClient) {
    const rs = await client.execute("SELECT user_id, COUNT(id) AS total_posts, SUM(votes) AS total_votes, SUM(download_count) AS total_downloads FROM posts GROUP BY user_id ORDER BY total_votes DESC LIMIT 10;")

    if (rs.rows.length === 0) {
        return null;
    }

    return mapToModel<GroupByUserIdResults>(rs.rows)
}


export async function updateVoteScore(client: TursoClient, post_id: number, new_score: number) {
    const rs = await client.execute({
        sql: "UPDATE posts SET votes = ? WHERE id = ? RETURNING id",
        args: [new_score, post_id]
    });

    if (rs.rows.length === 0) {
        throw new Error(`[updateVoteScore] Failed to update post ID ${post_id}. Post not found.`);
    }
}

export async function findByMessageId(client: TursoClient, message_id: number) {
    const rs = await client.execute({
        sql: "SELECT id FROM posts WHERE message_id = ?",
        args: [message_id]
    });

    if (rs.rows.length === 0) {
        return null
    }

    return mapToModel<Pick<PostModel, "id">>(rs.rows[0]);
}

export async function getAllPostsForSync(client: TursoClient): Promise<PostForSync[] | null> {
    const rs = await client.execute("SELECT id, name, download_count FROM posts");
    if (rs.rows.length === 0) {
        return null;
    }
    return mapToModel<PostForSync>(rs.rows);
}

export async function batchUpdateDownloadCounts(
    client: TursoClient, 
    updates: { id: number; newCount: number }[]
): Promise<void> {
    if (updates.length === 0) {
        return;
    }
    
    const tx = await client.transaction("write");
    try {
        const statements = updates.map(update => ({
            sql: "UPDATE posts SET download_count = ? WHERE id = ?",
            args: [update.newCount, update.id]
        }));
        
        await tx.batch(statements);
        await tx.commit();
        
    } catch (err) {
        console.error("Failed to batch update download counts, rolling back.", err);
        await tx.rollback();
        throw err;
    }
}


export async function getRankedPosts(
    client: TursoClient, 
    sinceDate: string | null,
    limit: number
): Promise<RankedPost[] | null> {
    
    let sql = `
        SELECT id, name, user_id, message_id, download_count, votes, tags
        FROM posts
    `;
    const args: (string | number)[] = [];

    if (sinceDate) {
        sql += " WHERE created_at >= ?";
        args.push(sinceDate);
    }

    sql += " ORDER BY download_count DESC LIMIT ?";
    args.push(limit);

    const rs = await client.execute({ sql, args });

    if (rs.rows.length === 0) {
        return null;
    }

    return mapToModel<RankedPost>(rs.rows);
}