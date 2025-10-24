import { TursoClient } from "../lib/turso.ts";
import { mapToModel } from "../lib/utils.ts";
import { PostModel } from "../types/models.ts";



export async function create(client: TursoClient, data: Pick<PostModel, "user_id" | "message_id" | "name" | "unique_file_id" | "download_url">) {
    const rs = await client.execute({
        sql: "INSERT INTO posts (user_id, message_id, name, unique_file_id, download_url) VALUES (?, ?, ?, ?, ?) RETURNING id",
        args: [data.user_id, data.message_id, data.name, data.unique_file_id, data.download_url]
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

type GroupByUserIdResults = {
    user_id: number;
    total_posts: number;
    total_votes: number;
    total_downloads: number;
}

export async function groupByUserId(client: TursoClient) {
    const rs = await client.execute("SELECT user_id, COUNT(id) AS total_posts, SUM(votes) AS total_votes, SUM(download_count) AS total_downloads FROM posts GROUP BY user_id ORDER BY total_votes DESC;")

    if (rs.rows.length === 0) {
        return null;
    }

    return mapToModel<GroupByUserIdResults>(rs.rows)
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