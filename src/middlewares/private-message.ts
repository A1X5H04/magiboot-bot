import { Filter, NextFunction } from "grammy";
import { AppContext } from "../types/context";
import { handlePrivateChat } from "../handlers/system";

export function privateMessageMiddleware(ctx: Filter<AppContext, "message">, next: NextFunction) {
    if (ctx.chat.type === "private") {
        handlePrivateChat(ctx);
        return;
    }
    
    next();
}