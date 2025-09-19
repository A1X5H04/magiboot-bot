import { Bot, session } from 'grammy';
import { Env } from '../types/cloudflare';
import { D1Adapter } from '@grammyjs/storage-cloudflare';
import { CustomContext, SessionData } from '../types/context';
import { commandHandlerMiddleware } from './middleware/command-handler';
import { formMiddleware } from './middleware/form';
import { routerMiddleware } from './middleware/router';

import commandComposer from './commands';
import routesComposer from './routes'

async function initBot(env: Env) {
    const grammyD1StorageAdapter = await D1Adapter.create<SessionData>(env.D1_DB, 'grammy_sessions')

    const bot = new Bot<CustomContext>(env.BOT_TOKEN, { botInfo: JSON.parse(env.BOT_INFO) });


    // Extend context with environment
    bot.use((ctx, next) => {
        ctx.env = env;
        return next();
    })

    bot.use(session({
        initial: () => {
            return { routerHistory: [], formState: {} }
        },
        storage: grammyD1StorageAdapter,
    }))
    bot.use(routerMiddleware);
    bot.use(formMiddleware);
    bot.use(commandComposer)
    bot.use(commandHandlerMiddleware)

    // Commands registery
    bot.use(routesComposer)
    // bot.use(appRoutes);

    return bot;
}

export default initBot
