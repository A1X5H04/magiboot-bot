import { Filter, NextFunction } from "https://esm.sh/grammy@1.38.3"
import { AppContext } from "../types/bot.ts";
import { handlePrivateChat } from "../handlers/system.ts";

export function privateMessageMiddleware(ctx: Filter<AppContext, "message">, next: NextFunction) {
    if (ctx.chat.type === "private") {
        handlePrivateChat(ctx);
        return;
    }
    
    next();
}