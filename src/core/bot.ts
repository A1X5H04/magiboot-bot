import { Bot} from 'grammy';
import { Env } from '../types/cloudflare';

import { AppContext } from '../types/context';

import commandComposer from './commands';
import { privateMessageMiddleware } from '../middlewares/private-message';
import { extendContextMiddleware } from '../middlewares/extend-ctx';

async function initBot(env: Env) {
    const bot = new Bot<AppContext>(env.BOT_TOKEN, { botInfo: JSON.parse(env.BOT_INFO) });

    // Extend context with environment
    bot.use(extendContextMiddleware({ env }))
    bot.on("message", privateMessageMiddleware);
    
    bot.use(commandComposer)

    return bot;
}

export default initBot
