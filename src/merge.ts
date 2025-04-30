import { readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { loadSchema } from './loadSchema.js';

/**
 * Deduplicates array items using a key-generating function.
 */
function deduplicateBy<T>(arr: T[], keyFn: (item: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const item of arr) {
    const key = keyFn(item).toLowerCase();
    if (!seen.has(key)) seen.set(key, item);
  }
  return Array.from(seen.values());
}

/**
 * Merges and deduplicates partial university files into one validated file.
 */
export function mergeUniversityFiles(university: string, runDir: string, schemaPath = './src/schema.json') {
  const files = readdirSync(runDir).filter(f => f.startsWith(university + '-') && f.endsWith('.json'));
  console.log(`📦 Merging ${files.length} partial files for ${university}`);

  const { schema, fieldTypes, dedupeKeys } = loadSchema(schemaPath);
  const merged: Record<string, any> = {};

  for (const file of files) {
    const fullPath = join(runDir, file);
    const raw = readFileSync(fullPath, 'utf-8');
    const parsed = JSON.parse(raw);

    for (const [key, value] of Object.entries(parsed)) {
      if (value === undefined || value === null) continue;

      if (fieldTypes[key] === 'string') {
        merged[key] = (merged[key] || '') + value + ' ';
      } else if (fieldTypes[key] === 'array') {
        merged[key] = (merged[key] || []).concat(value);
      } else {
        merged[key] ??= value; // fallback for other field types (like id, name)
      }
    }
  }

  // 🧹 Deduplicate any array fields using provided dedupe keys
  for (const [field, dedupeKey] of Object.entries(dedupeKeys)) {
    if (dedupeKey && Array.isArray(merged[field])) {
      merged[field] = deduplicateBy(merged[field], (item: any) => item?.[dedupeKey] || '');
    }
  }

  // 🧼 Final trim for strings
  for (const [key, value] of Object.entries(merged)) {
    if (typeof value === 'string') {
      merged[key] = value.trim();
    }
  }

  // ✅ Validate
  const validated = schema.parse(merged);
  const mergedFilename = `${university}-${runDir.split("/").pop()}.json`;
  const outputPath = join(runDir, mergedFilename);
  writeFileSync(outputPath, JSON.stringify(validated, null, 2));

  console.log(`✅ Merged into ${outputPath}`);

  // 🧽 Clean up temp files
  for (const file of files) {
    if (file !== mergedFilename) {
      unlinkSync(join(runDir, file));
    }
  }
  console.log(`🧹 Deleted ${files.length - 1} temp files.`);
}
