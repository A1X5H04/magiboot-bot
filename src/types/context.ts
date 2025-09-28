import { Context as GrammyContext } from 'grammy';
import { Env } from "./cloudflare";

// Extend the base context with our custom properties

export interface ExtendedContext extends GrammyContext {
    env: Env
}    


export type CustomContext = ExtendedContext;