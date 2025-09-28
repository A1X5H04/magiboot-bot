import { webhookCallback } from 'grammy';
import { Env } from './types/cloudflare';
import initBot from './core/bot';
import handleStatus from './webhooks/status';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    try {
      
      const bot = await initBot(env)

      if (url.pathname === "/webhooks/status") {
        return await handleStatus(bot, request);
      }


      if (url.pathname === "/webhooks/tg") {
        const handleRequest = webhookCallback(bot, 'cloudflare-mod');
        return await handleRequest(request);
      }

    
      // everything else gets 404
      return new Response("Not Found", { status: 404 });


    } catch (err) {
      console.error('Error handling request:', err);
      return new Response('Server Error', { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;