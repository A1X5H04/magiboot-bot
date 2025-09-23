import { Bot} from 'grammy';
import { Env } from '../types/cloudflare';

import { CustomContext } from '../types/context';

import commandComposer from './commands';

async function initBot(env: Env) {
    

    const bot = new Bot<CustomContext>(env.BOT_TOKEN, { botInfo: JSON.parse(env.BOT_INFO) });


    // Extend context with environment
    bot.use((ctx, next) => {
        ctx.env = env;
        return next();
    })

    // bot.use(session({
    //     initial: () => {
    //         return { routerHistory: [], formState: {} }
    //     },
    //     storage: grammyD1StorageAdapter,
    // }))
    bot.use(commandComposer)

    return bot;
}

export default initBot
