import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import * as dotenv from 'dotenv';
dotenv.config();

const summarySchema = z.object({
  summary: z.string(),
});

export async function summarizeText(pageText: string) {
  const { object } = await generateObject({
    model: openai('gpt-4.5-preview'),
    schema: summarySchema,
    prompt: `
Summarize the following university webpage clearly and concisely. Return only a single string labeled 'summary'.

Page Content:
${pageText}
`.trim(),
  });

  console.log("\n--- Summary ---");
  console.log(object.summary);
}