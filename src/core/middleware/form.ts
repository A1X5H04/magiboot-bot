import { NextFunction } from "grammy";
import { CustomContext } from "../../types/context";

function setDeep(obj: Record<string, any>, path: string, value: any) {
  const keys = path.split(".");
  let current = obj;
  keys.forEach((key, i) => {
    if (i === keys.length - 1) {
      current[key] = value;
    } else {
      if (!current[key] || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key];
    }
  });
}

function getDeep(obj: Record<string, any>, path: string) {
  let current = obj;
  const keys = path.split(".");

  for (const key of keys) {
    if (current && Object.prototype.hasOwnProperty.call(current, key)) {
      current = current[key];
    } else {
      return undefined; // key missing
    }
  }

  return current; // could be any value, even null/undefined
}

function deleteDeep(obj: Record<string, any>, path: string) {
  const keys = path.split(".");
  let current = obj;
  keys.forEach((key, i) => {
    if (i === keys.length - 1) {
      delete current[key];
    } else {
      if (!current[key] || typeof current[key] !== "object") {
        return;
      }
      current = current[key];
    }
  });
}

export async function formMiddleware(ctx: CustomContext, next: NextFunction) {
  if (!ctx.session.formState) {
    ctx.session.formState = {};
  }

  ctx.form = {
    set: (path: string, value: any) => {
      setDeep(ctx.session.formState, path, value);
    },
    setWithValidation: (path: string, value: any, validator: (value: any) => string | null) => {
      const error = validator(value);
      if (error) return error;
      setDeep(ctx.session.formState, path, value);
      return null;
    },
    get: (path: string) => {
      return getDeep(ctx.session.formState, path);
    },
    delete: (path: string) => {
      deleteDeep(ctx.session.formState, path);
    },
    reset: () => {
      ctx.session.formState = {};
    },
    all: () => {
      return { ...ctx.session.formState };
    }
  };

  await next();
}
