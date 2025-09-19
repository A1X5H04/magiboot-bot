import { Context as GrammyContext, SessionFlavor } from 'grammy';
import { Env } from './cloudflare';


interface IRouter {
  path: string;
  push: (path: string) => void;
  pop: () => void;
  replace: (path: string) => void;
  restart: (initialPath?: string) => void;
  history: string[];
};

interface IForm {
  set: (path: string, value: any) => void;
  setWithValidation: <V>(path: string, value: V, validator: (value: V) => string | null) => string | null;
  get: (path: string) => any;
  delete: (path: string) => void;
  reset: () => void;
  // validate: (rules: Record<string, (value: any) => string | null>) => Record<string, string>;
  all: () => Record<string, any>;
}

export interface SessionData {
  routerHistory: string[];
  formState: Record<string, any>;
}

interface ExtendedContext extends GrammyContext {
  router: IRouter;
  form: IForm;
  env: Env;
}

// Extend the base context with our custom properties
export type CustomContext = ExtendedContext & SessionFlavor<SessionData>;



// Re-export the base context type for convenience
export { Context } from 'grammy';

