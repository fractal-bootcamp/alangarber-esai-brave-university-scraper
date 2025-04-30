import { generateObject, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z, ZodTypeAny, ZodString, ZodArray } from 'zod';
import { FieldType } from './loadSchema.js';
import 'dotenv/config';

interface ExtractionOptions {
  field: string;
  text: string;
  zodSchema: ZodTypeAny;
  fieldType: FieldType;
}

/**
 * Generate a basic prompt based on field type and name.
 * If desired, you can extend this later to pull from a user-defined template.
 */
function generatePrompt(field: string, fieldType: FieldType): string {
  if (fieldType === 'string') {
    return `
Extract a concise summary of the field "${field}" from the following university web page text.
Return a simple plain text string.
`.trim();
  }

  if (fieldType === 'array') {
    return `
Extract a list of values for the field "${field}" from the following university web page text.
Return a JSON object with a single key "items", containing an array of structured entries matching the schema.
`.trim();
  }

  throw new Error(`Unsupported field type for prompt: ${fieldType}`);
}

export async function extractStructuredData({ field, text, zodSchema, fieldType }: ExtractionOptions): Promise<any> {
  try {
    const prompt = generatePrompt(field, fieldType);

    const baseSchema = typeof (zodSchema as any).unwrap === 'function'
      ? (zodSchema as any).unwrap()
      : zodSchema;

    if (baseSchema instanceof ZodString) {
      const { text: result } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt: `${prompt}\n\nText:\n${text}`.trim(),
      });
      return result.trim();
    }

    if (baseSchema instanceof ZodArray) {
      const { object } = await generateObject({
        model: openai('gpt-4o-mini'),
        schema: z.object({ items: baseSchema }),
        prompt: `${prompt}\n\nText:\n${text}\n\nReturn as: { "items": [...] }`.trim(),
      });
      return object.items;
    }

    console.warn(`⚠️ Unsupported Zod schema type for field: ${field}`);
    return null;
  } catch (err) {
    console.error(`❌ Failed to extract ${field}:`, err);
    return null;
  }
}
