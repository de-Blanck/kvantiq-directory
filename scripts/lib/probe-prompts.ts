// scripts/lib/probe-prompts.ts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import type { PromptsFile } from './probe-types.ts';

const promptSchema = z.object({
  id: z.string().min(1),
  dimension: z.enum(['geographic', 'modality', 'category', 'entity', 'discovery']),
  text: z.string().min(10),
});

const promptsFileSchema = z.object({
  version: z.string().min(1),
  prompts: z.array(promptSchema).min(1),
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = resolve(__dirname, '../../data/probes/prompts.json');

export async function loadPrompts(path: string = DEFAULT_PATH): Promise<PromptsFile> {
  const raw = await readFile(path, 'utf-8');
  const parsed = promptsFileSchema.parse(JSON.parse(raw));
  const ids = new Set(parsed.prompts.map(p => p.id));
  if (ids.size !== parsed.prompts.length) {
    throw new Error('Duplicate prompt IDs detected');
  }
  return parsed;
}
