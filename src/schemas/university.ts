import { z } from 'zod';

/**
 * University Schema
 * Matches ESAI project spec.
 */

export const universitySchema = z.object({
  id: z.string().optional(), // will be added later
  name: z.string(),
  website: z.string(),
  characterSummary: z.string().optional(),
  admissionsFocus: z.string().optional(),
  knownFor: z.array(z.string()).optional(),
  studentOrgs: z.array(z.object({
    name: z.string(),
    category: z.string().optional(),    // e.g. Cultural, Academic, Pre-professional
    description: z.string().optional(),
    url: z.string().optional(),
  })).optional(),
  professors: z.array(z.object({
    name: z.string(),
    department: z.string().optional(),
    bioSnippet: z.string().optional(),
  })).optional(),
  events: z.array(z.object({
    title: z.string(),
    date: z.string().optional(),
    description: z.string().optional(),
  })).optional(),
  scrapedAt: z.string().optional(), // ISO timestamp
});

export type UniversityData = z.infer<typeof universitySchema>;
