import { z } from 'zod';
import { createHash } from 'node:crypto';
import { normalizeUrl } from '../../src/lib/events/url';
import type { HoldReason } from '../events/check';

export const COLLECTIONS = ['companies', 'resources', 'benchmarks', 'challenges', 'use-cases'] as const;
export type Collection = typeof COLLECTIONS[number];

export type LegacyItem = {
  entity: string;
  collection: Collection;
  file: string;
  url: string;
  title: string;
  excerpt: string | null;
  source: string;
  date: string;
};

export type NewsRef = {
  entity: string;
  url: string;
  title: string;
  excerpt: string | null;
  source: string;
  date: string;
  origin: 'legacy' | 'harvest';
  refs: string[];
};

export function hash12(url: string): string {
  return createHash('sha256').update(normalizeUrl(url)).digest('hex').slice(0, 12);
}

export const harvestedSourceSchema = z.object({
  type: z.enum(['doi', 'arxiv', 'url', 'website', 'press-release']),
  url: z.string().url(),
  title: z.string().trim().min(1).optional(),
  authors: z.string().trim().min(1).optional(),
  datePublished: z.string().trim().min(1).optional(),
  dateAccessed: z.string().trim().min(1).optional(),
});

export type HarvestSource = {
  entity: string;
  source: z.infer<typeof harvestedSourceSchema>;
  refs: string[];
};

export type HarvestChange = {
  entity: string;
  field: string;
  from: unknown;
  to: unknown;
  ref: string;
  headDate: string;
  superseded: Array<{ ref: string; to: unknown }>;
};

export type Harvest = {
  refs: Array<{ ref: string; head: string; base: string; headDate: string; otherPaths: string[] }>;
  news: Array<LegacyItem & { refs: string[]; foundOn: string }>;
  sources: HarvestSource[];
  changes: HarvestChange[];
};

export type WorkClass = 'fetch' | 'pointer-only' | 'blocklisted' | 'homepage' | 'listing';

export type WorkItem = {
  id: string;
  url: string;
  resolvedFrom: string[];
  entities: string[];
  collections: Collection[];
  cls: WorkClass;
  refs: NewsRef[];
  happenedOnHint: string;
  foundOn: string;
};

export type Aliases = Record<string, string>;
export type MatchResult = { status: 'event'; eventId: string } | { status: 'held'; reason: HoldReason } | null;
