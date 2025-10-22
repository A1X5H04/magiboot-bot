import { Row } from "https://esm.sh/@libsql/client@0.15.15";
import { BootAnimPart, ValidationRule } from "../types/utils.ts";

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


const SHORTHAND_MAP: Record<string, [BootAnimPart['type'], number, number]> = {
  'loop': ['c', 0, 0],   // c 0 0: complete, loop forever, 0 pause
  'once': ['c', 1, 0],   // c 1 0: complete, play once, 0 pause
  'play': ['p', 1, 0],   // p 1 0: partial, play once, 0 pause
};

/**
 * Parses the raw configuration string into an array of BootAnimPart objects.
 * Assumes the configuration is space-separated, e.g., '3.loop 7.once end.p.2.30'
 * @param configString The raw configuration string (excluding /b "name").
 * @returns An array of structured BootAnimPart objects.
 */
export function parseBootAnimConfig(configString: string): BootAnimPart[] {
  const parts: BootAnimPart[] = [];
  const tokens = configString.trim().split(/\s+/); // Split by one or more spaces

  if (!configString.trim()) {
    return [];
  }

  for (const token of tokens) {
    const [timeStr, ...configParts] = token.split('.');
    const timeframe: BootAnimPart["timeframe"] = {
      value: 0,
      unit: 'seconds'
    }

    // 1. Parse time
    if (timeStr.toLowerCase() === 'end') {
      timeframe.value = null;
      timeframe.unit = 'end'
    } else {
      const timeMatch = timeStr.match(/^(\d+(?:\.\d+)?)([sf])?$/i);

      if (!timeMatch) {
        throw new Error(`Invalid time format in token: ${token}. Use 'end', a number (e.g., '3' or '3.5s'), or frames (e.g., '120f').`);
      }

      timeframe.value = parseFloat(timeMatch[1]);
      const unitSuffix = timeMatch[2] ? timeMatch[2].toLowerCase() : undefined;
      unitSuffix === 'f' ? timeframe.unit = 'frames' : timeframe.unit = 'seconds'

    }

    const config = configParts.join('.');

    // 2. Parse behavior (shorthand or custom)
    let type: BootAnimPart['type'];
    let count: number;
    let pause: number;

    if (config in SHORTHAND_MAP) {
      [type, count, pause] = SHORTHAND_MAP[config];
    } else {
      // Custom format: <type>.<count>.<pause>
      const customMatch = config.match(/^([pc])\.(\d+)\.(\d+)$/i);
      if (customMatch) {
        // [fullMatch, type, count, pause]
        type = customMatch[1].toLowerCase() as BootAnimPart['type'];
        count = parseInt(customMatch[2], 10);
        pause = parseInt(customMatch[3], 10);
      } else {
        throw new Error(`Invalid behavior syntax: ${config} in token: ${token}. Please refer to docs for more info.`);
      }
    }

    parts.push({ timeframe, type, count, pause });
  }

  return parts;
}


export const splitTitleAndConfig = (rawArgs: string | null): { title: string, config: string } | null => {
  if (!rawArgs) return null;

  const REGEX = /^\s*"(.*?)"\s*(.*)$|^\s*(\S+)\s*(.*)$/s;

  const match = REGEX.exec(rawArgs);
  if (!match) return null;

  let rawTitle: string;
  let rawConfig: string;

  if (match[1] !== undefined) {
    
    rawTitle = match[1]; 
    rawConfig = match[2];
  } else if (match[3] !== undefined) {
    rawTitle = match[3];
    rawConfig = match[4];
  } else {
    // This path is a safety net but should not be hit if the regex is correct
    return null;
  }

  return { 
    title: rawTitle.trim(), 
    config: rawConfig.trim() 
  };
};