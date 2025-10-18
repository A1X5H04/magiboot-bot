import { Row } from "https://esm.sh/@libsql/client@0.15.15";
import { ValidationRule } from "../types/utils.ts";

export function mapToModel<T>(data: Row): T;
export function mapToModel<T>(data: Row[]): T[];
export function mapToModel<T>(data: Row | Row[]): T | T[] {
    const autoParse = (value: unknown): unknown => {
        if (typeof value === 'string') {
            if (/^({.*}|\[.*\])$/s.test(value)) {
                try {
                    // Recurse on the *result* of the parse.
                    return autoParse(JSON.parse(value));
                } catch (error) {
                    console.error(`[mapToModel] Failed to parse JSON string:`, { value, error });
                    return value;
                }
            }
        }

        if (Array.isArray(value)) {
            return value.map(item => autoParse(item));
        }

        if (value && typeof value === 'object' && value.constructor === Object) {
            return Object.fromEntries(
                Object.entries(value).map(([key, val]) => [key, autoParse(val)])
            );
        }
        
        return value;
    };

    if (Array.isArray(data)) {
        return data.map(row => autoParse(row) as T);
    }
    return autoParse(data) as T;
}



export function runValidations<T>(item: T, rules: ValidationRule<T>[]): string[] {
  const errors: string[] = [];
  for (const rule of rules) {
    const error = rule(item);
    if (error) {
      errors.push(error);
    }
  }
  
  return errors;
}
