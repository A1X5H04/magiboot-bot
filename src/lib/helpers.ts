import { Context } from "https://esm.sh/grammy@1.38.3/out/mod.d.ts";
import { StatusUpdate } from "../types/schema.ts";
import { TGUserInfo } from "../types/bot.ts";

export async function sendStatusUpdate(data: StatusUpdate) {
    const baseURL = Deno.env.get("BOT_BASE_URL");

    const res = await fetch(`${baseURL}/bot/status`, {
        method: "POST",
        body: JSON.stringify({
            status: data.status,
            message: data.status === "failed" ? data.message : undefined,
            tg_metadata: data.tg_metadata,
        })
    })

    if (!res.ok) {
        throw new Error(`Failed to send status update: ${res.status}`);
    }

    return await res.text();
}

export async function getUserInfo(api: Context["api"], chat_id: string | number, user_id: number): Promise<TGUserInfo> {
    try {
        const { user: memberUser } = await api.getChatMember(chat_id, user_id);

        return {
            id: memberUser.id,
            first_name: memberUser.first_name,
            last_name: memberUser.last_name,
            username: memberUser.username
        }
    } catch (err) {
        console.error("[getUserInfo]: Failed to fetch user info", err);
        return {
            id: user_id,
            first_name: "Unknown",
            last_name: "User",
            username: undefined
        }
    }

}