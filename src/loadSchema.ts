import { z, ZodObject, ZodTypeAny } from 'zod';
import { readFileSync } from 'fs';
import path from 'path';

export type FieldType = 'string' | 'array';

interface FieldConfig {
  type: FieldType;
  optional?: boolean;
  search?: string;
  dedupeBy?: string;
  avoid?: string[];
  items?: Record<string, string>; // for arrays
}

interface RawSchema {
  [fieldName: string]: FieldConfig;
}

interface LoadSchemaResult {
  schema: ZodObject<any>;
  fieldQueries: Record<string, string>;
  fieldTypes: Record<string, FieldType>;
  dedupeKeys: Record<string, string | undefined>;
  fieldAvoidList: Record<string, string[]>;
  globalAvoidList: string[];
}

/**
 * Loads schema from either a file path or inline JSON string.
 * If `schemaText` is provided, it takes priority over `schemaPath`.
 */
export function loadSchema(schemaPath?: string, schemaText?: string): LoadSchemaResult {
  let json: RawSchema;
  let baseDir = '.';

  if (schemaText) {
    json = JSON.parse(schemaText);
  } else if (schemaPath) {
    const raw = readFileSync(schemaPath, 'utf-8');
    json = JSON.parse(raw);
    baseDir = path.dirname(schemaPath);
  } else {
    throw new Error("You must provide either a schemaPath or schemaText.");
  }

  const shape: Record<string, ZodTypeAny> = {};
  const fieldQueries: Record<string, string> = {};
  const fieldTypes: Record<string, FieldType> = {};
  const dedupeKeys: Record<string, string | undefined> = {};
  const fieldAvoidList: Record<string, string[]> = {};

  for (const [field, config] of Object.entries(json)) {
    const isOptional = config.optional ?? false;

    if (config.search) {
      fieldQueries[field] = config.search;
    }

    if (config.dedupeBy) {
      dedupeKeys[field] = config.dedupeBy;
    }

    if (config.avoid) {
      fieldAvoidList[field] = config.avoid;
    }

    if (config.type === 'string') {
      const zodField = z.string();
      shape[field] = isOptional ? zodField.optional() : zodField;
      fieldTypes[field] = 'string';
    } else if (config.type === 'array') {
      const itemShape: Record<string, ZodTypeAny> = {};

      for (const [key, val] of Object.entries(config.items ?? {})) {
        const optional = val.endsWith('?');
        const base = val.replace('?', '');
        if (base === 'string') {
          itemShape[key] = optional ? z.string().optional() : z.string();
        } else {
          throw new Error(`Unsupported item type "${val}" for key "${key}"`);
        }
      }

      const arraySchema = z.array(z.object(itemShape));
      shape[field] = isOptional ? arraySchema.optional() : arraySchema;
      fieldTypes[field] = 'array';
    } else {
      throw new Error(`Unsupported field type "${config.type}" for field "${field}"`);
    }
  }

  // Load global avoid list if path was used
  let globalAvoidList: string[] = [];
  if (process.env.GLOBAL_AVOID_DOMAINS) {
    try {
      globalAvoidList = JSON.parse(process.env.GLOBAL_AVOID_DOMAINS);
    } catch (err) {
      console.warn(`⚠️ Failed to parse GLOBAL_AVOID_DOMAINS env variable. Must be a JSON array of domains.`);
    }
  } else if (!schemaText && schemaPath) {
    const avoidPath = path.join(path.dirname(schemaPath), 'permanently_banned.json');
    try {
      globalAvoidList = JSON.parse(readFileSync(avoidPath, 'utf-8'));
    } catch (err) {
      console.warn(`⚠️ Could not load global avoid list at ${avoidPath}`);
    }
  }
  
  return {
    schema: z.object(shape),
    fieldQueries,
    fieldTypes,
    dedupeKeys,
    fieldAvoidList,
    globalAvoidList,
  };
}
