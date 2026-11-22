import { createHash } from 'node:crypto';
import { normalizeUrl } from '../../src/lib/events/url';

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
