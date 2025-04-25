import { readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { universitySchema, UniversityData } from './schemas/university.js';

function deduplicateBy<T>(arr: T[], keyFn: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of arr) map.set(keyFn(item).toLowerCase(), item);
  return Array.from(map.values());
}

export function mergeUniversityFiles(university: string, runDir: string) {
  const files = readdirSync(runDir).filter(f => f.startsWith(university + '-') && f.endsWith('.json'));
  console.log(`📦 Merging ${files.length} partial files for ${university}`);

  const merged: UniversityData = {
    id: '',
    name: '',
    website: '',
    characterSummary: '',
    admissionsFocus: '',
    knownFor: [],
    studentOrgs: [],
    professors: [],
    events: [],
    scrapedAt: '',
  };

  for (const file of files) {
    const fullPath = join(runDir, file);
    const raw = readFileSync(fullPath, 'utf-8');
    const parsed = JSON.parse(raw);

    if (parsed.characterSummary) merged.characterSummary += parsed.characterSummary + ' ';
    if (parsed.admissionsFocus) merged.admissionsFocus += parsed.admissionsFocus + ' ';

    if (!merged.id && parsed.id) merged.id = parsed.id;
    if (!merged.name && parsed.name) merged.name = parsed.name;
    if (!merged.website && parsed.website) merged.website = parsed.website;
    if (!merged.scrapedAt && parsed.scrapedAt) merged.scrapedAt = parsed.scrapedAt;

    if (parsed.knownFor) merged.knownFor?.push(...parsed.knownFor);
    if (parsed.studentOrgs) merged.studentOrgs?.push(...parsed.studentOrgs);
    if (parsed.professors) merged.professors?.push(...parsed.professors);
    if (parsed.events) merged.events?.push(...parsed.events);
  }

  merged.knownFor = Array.from(new Set(merged.knownFor?.map(v => v.toLowerCase())));
  merged.studentOrgs = deduplicateBy(merged.studentOrgs ?? [], o => o.name);
  merged.professors = deduplicateBy(merged.professors ?? [], p => p.name);
  merged.events = deduplicateBy(merged.events ?? [], e => e.title + (e.date || ''));

  const validated: UniversityData = universitySchema.parse(merged);

  const mergedFilename = `${university}-${runDir.split("/").pop()}.json`;
  const outputPath = join(runDir, mergedFilename);
  writeFileSync(outputPath, JSON.stringify(validated, null, 2));
  console.log(`✅ Merged into ${outputPath}`);

  // ❗ Delete only original files, NOT the final merged file
  for (const file of files) {
    if (file !== mergedFilename) {
      unlinkSync(join(runDir, file));
    }
  }
  console.log(`🧹 Deleted ${files.length - 1} temp files.`);

  console.log(JSON.stringify(validated, null, 2));
}
