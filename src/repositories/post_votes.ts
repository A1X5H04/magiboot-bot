import { TursoClient } from "../lib/turso.ts";

export async function upsertUserVote(client: TursoClient, post_id: number, user_id: number, vote_value: number) {
    await client.execute({
        sql: `
            INSERT INTO post_votes (post_id, user_id, vote_value)
            VALUES (?, ?, ?)
            ON CONFLICT(post_id, user_id) DO UPDATE SET
                vote_value = excluded.vote_value,
                updated_at = (strftime('%Y-%m-%d %H:%M:%f', 'now'))
        `,
        args: [post_id, user_id, vote_value]
    });
}