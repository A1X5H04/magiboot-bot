import { createClient, type Client } from "https://esm.sh/@libsql/client/web";

export function createTursoClient(): Client {
    const url = Deno.env.get("TURSO_DATABASE_URL");
    const authToken = Deno.env.get("TURSO_AUTH_TOKEN");

    if (!url) {
        throw new Error("TURSO_DATABASE_URL environment variable not set");
    }

    return createClient({
        url,
        authToken,
    });
}

// Re-export client for non-ambguity
export type TursoClient = Client;