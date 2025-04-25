import { readFileSync, writeFileSync } from 'fs';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

interface UniversityData {
  characterSummary: string;
  admissionsFocus: string;
  knownFor: string[];
  studentOrgs: { name: string; description: string }[];
  professors: { name: string; department?: string; bio: string }[];
  events: { title: string; date?: string; description?: string }[];
}

async function summarizeField(fieldName: string, rawText: string): Promise<string> {
  const { text } = await generateText({
    model: openai("gpt-4"),
    prompt: `Summarize the following university field called "${fieldName}" into 2-3 clear and non-repetitive sentences:

${rawText}`,
  });
  return text.trim();
}

export async function cleanMergedFile(filePath: string) {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed: UniversityData = JSON.parse(raw);

  // Summarize long fields
  parsed.characterSummary = await summarizeField("characterSummary", parsed.characterSummary);
  parsed.admissionsFocus = await summarizeField("admissionsFocus", parsed.admissionsFocus);

  writeFileSync(filePath, JSON.stringify(parsed, null, 2));
  console.log(`✨ Cleaned and saved summarized file: ${filePath}`);
}
