import { generateObject, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import 'dotenv/config';

export type UniversityField = 'characterSummary' | 'admissionsFocus' | 'knownFor' | 'studentOrgs' | 'professors' | 'events';

const fieldSchemas: Record<UniversityField, z.ZodTypeAny> = {
  characterSummary: z.string(),
  admissionsFocus: z.string(),
  knownFor: z.array(z.string()),
  studentOrgs: z.array(z.object({
    name: z.string(),
    category: z.string().optional(),
    description: z.string().optional(),
    url: z.string().optional(),
  })),
  professors: z.array(z.object({
    name: z.string(),
    department: z.string().optional(),
    bioSnippet: z.string().optional(),
  })),
  events: z.array(z.object({
    title: z.string(),
    date: z.string().optional(),
    description: z.string().optional(),
  })),
};

const prompts: Record<UniversityField, string> = {
  characterSummary: `
Summarize the general character and vibe of the university in 1-3 clear sentences.
Return a simple string.
`.trim(),

  admissionsFocus: `
Summarize the university's admissions philosophy based on this text, in 1-3 clear sentences.
If test-optional, holistic, GPA-focused, etc., mention that.
Return a simple string.
`.trim(),

  knownFor: `
Extract notable fields of study or academic areas the university is known for.
Return a JSON array of strings.
`.trim(),

  studentOrgs: `
Extract a list of student organizations from the text.
Return a JSON array of objects like: { "name": "...", "category": "...", "description": "...", "url": "..." }
`.trim(),

  professors: `
Extract a list of professors mentioned in the text.
Return a JSON array of objects like: { "name": "...", "department": "...", "bioSnippet": "..." }
`.trim(),

  events: `
Extract a list of upcoming or notable university events from the text.
Return a JSON array of objects like: { "title": "...", "date": "...", "description": "..." }
`.trim(),
};

export async function extractStructuredData(field: UniversityField, text: string): Promise<any> {
  const schema = fieldSchemas[field];

  if (!schema) {
    console.warn(`⚠️ No schema defined for field ${field}`);
    return null;
  }

  if (schema instanceof z.ZodString) {
    // If the schema is a simple string
    const { text: generated } = await generateText({
      model: openai('gpt-4o'),
      prompt: `
Extract information for field "${field}" from the following page text.

${prompts[field]}

Text:
${text}
`.trim(),
    });
    return generated.trim();
  }

  if (schema instanceof z.ZodArray) {
    // 🧠 If the schema is a ZodArray, we need to wrap it in an object!
    const { object } = await generateObject({
      model: openai('gpt-4o'),
      schema: z.object({ items: schema }),
      prompt: `
Extract information for field "${field}" from the following page text.

${prompts[field]}

Text:
${text}
Return as JSON with an "items" array.
`.trim(),
    });
    return object.items; // ✅ Extract the actual array from the wrapped object
  }

  // Otherwise fallback (should not happen)
  console.warn(`⚠️ Unsupported schema type for field ${field}`);
  return null;
}
