// netlify/edge-functions/scheduled/queue-worker.ts
import type { Config } from "https://esm.sh/@netlify/edge-functions";
import { handleJob } from "../../../src/services/ci/orchestrator.ts";

export default async function handler(req: Request) {
    const secret = Deno.env.get("CRON_SECRET");
    const auth = req.headers.get("Authorization");
    if (!secret || `Bearer ${secret}` !== auth) {
        console.warn("[QueueJanitor] Unauthorized cron job access.");
        return new Response("Unauthorized", { status: 401 });
    }
    
    console.log("[QueueJanitor] Running...")

    try {
        await handleJob()
    } catch (err) {
        console.error("[QueueWorker] CRITICAL ERROR in main worker:", err);
        return new Response(`Error: ${(err as Error).message}`, { status: 500 });
    }
}

export const config: Config = {
  path: "/scheduled/queue-worker",
};