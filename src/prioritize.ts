import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import * as dotenv from 'dotenv';
dotenv.config();

const prioritizationSchema = z.object({
  selected: z.array(z.number()),
});

export async function askLLMToPrioritizeLinks(links: { href: string; text: string }[]) {
  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: prioritizationSchema,
    prompt: `
You are selecting the 10–14 most useful links from a university website to help understand the school's:
- Admissions
- Academics
- Professors
- Student Life
- Events

Return an array of 1-based indices pointing to the most useful links as JSON.

Links:
${links.map((l, i) => `${i + 1}. ${l.text} - ${l.href}`).join("\n")}
`.trim()
  });

  return object.selected
    .map(i => links[i - 1]) // Convert 1-based indices to 0-based
    .filter(Boolean);
}