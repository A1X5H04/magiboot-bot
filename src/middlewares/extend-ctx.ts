import { MiddlewareFn } from "grammy";
import { AppContext, ExtendedCtxData } from "../types/context";

export function extendContextMiddleware(data: ExtendedCtxData): MiddlewareFn<AppContext> {
    return (ctx, next) => {
        Object.assign(ctx, data)
        return next();
    }
}

