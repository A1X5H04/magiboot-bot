import { Context as GrammyContext } from 'grammy';
import { Env } from './cloudflare';

// Extend the base context with our custom properties
type ExtendedContext = GrammyContext & {
    env: Env;
}

export type CustomContext = ExtendedContext