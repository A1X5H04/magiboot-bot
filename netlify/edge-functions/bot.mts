import type { Config } from "https://esm.sh/@netlify/edge-functions";
import { webhookCallback } from "https://esm.sh/grammy";
import { initBot } from "../../src/core/bot.ts"
import handleStatus from "../../src/handlers/webhooks.ts";

export default async function handler(req: Request) {
  const url = new URL(req.url);
  try {

    console.log("✅ Edge function invoked for path:", url.pathname);

    const bot = initBot();
    if (url.pathname === "/bot/reset-webhook") {
      try {
        await bot.api.deleteWebhook({ drop_pending_updates: true })
        
        await bot.api.setWebhook(`${Deno.env.get("BOT_BASE_URL")}/bot/tg-webhook`, {
          allowed_updates: ["message", "message_reaction_count"]
        })

        return new Response("Webhook reset!", { status: 201 });

      } catch (error) {
        console.log("Failed to reset the webhook!", JSON.stringify(error));
        return new Response("Failed to reset webhook", { status: 500 })
      }
    }


    if (url.pathname === "/bot/status") {
      return await handleStatus(bot, req);
    }

    if (url.pathname === "/bot/tg-webhook") {
      try {
        const handleRequest = webhookCallback(bot, "std/http");
        return await handleRequest(req);
      } catch (err) {
        console.error("❌ Error in Telegram webhook:", err);
        return new Response("OK", { status: 200 });
      }
    }

    // everything else gets 404
    return new Response(`Not Found: ${req.url}`, { status: 404 });

  } catch (err) {
    console.error("Error handling request:", err);
    return new Response("Server Error", { status: 500 });
  }
}


export const config: Config = {
  path: "/bot*"
  
};