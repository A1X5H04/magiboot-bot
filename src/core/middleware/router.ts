import { NextFunction } from "grammy";
import { CustomContext } from "../../types/context";

export async function routerMiddleware(ctx: CustomContext, next: NextFunction) {

    const initialPath = '';

    if (!ctx.session.routerHistory) {
        ctx.session.routerHistory = [initialPath];
    }

    const history = ctx.session.routerHistory;

    ctx.router = {
        get path() {
            return history[history.length - 1] || '';
        },
        push(path) {
            history.push(path);
        },
        pop() {
            if (history.length > 1) history.pop();
        },
        replace(path) {
            history[history.length - 1] = path;
        },
        restart(newPath = initialPath) {
            ctx.session.routerHistory = [newPath];
        },
        get history() {
            return [...history];
        },
    };

    await next();
}