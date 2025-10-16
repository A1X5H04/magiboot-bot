import { Context as GrammyContext } from "https://esm.sh/grammy";

// // Extend the base context with our custom properties
// export interface ExtendedCtxData {
//   env: Env;
// }

interface ExtendedContext extends GrammyContext {}  


export type AppContext = ExtendedContext;


export type TGUserInfo = {
    id: number;
    first_name: string;
    last_name: string | undefined;
    username: string | undefined;
}