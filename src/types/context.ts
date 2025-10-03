import { Context as GrammyContext } from 'grammy';
import { Env } from "./cloudflare";

// Extend the base context with our custom properties
export interface ExtendedCtxData {
  env: Env;
}

interface ExtendedContext extends GrammyContext, ExtendedCtxData {}  


export type AppContext = ExtendedContext;