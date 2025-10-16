import * as postRepositories from "../repositories/post.ts"
import { createTursoClient } from "../lib/turso.ts";
import { PostModel } from "../types/models.ts"

const db = createTursoClient();

export async function getPostByNameOrUniqueId(name: string, unique_file_id: string) {
    const result = await postRepositories.findByNameOrUniqueFileId(db, name, unique_file_id);
    return result;
}


export async function createPost(data: Pick<PostModel, "user_id" | "message_id" | "name" | "unique_file_id" | "download_url">) {
    const result = await postRepositories.create(db, data);
    return result;
}