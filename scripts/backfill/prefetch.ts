import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { FetchedPage } from '../events/check';
import { htmlToText, publishedDates } from '../events/page';

export type CachedPage = {
  id: string;
  url: string;
  fetchedOn: string;
  status: number;
  contentType: string;
  finalUrl: string;
  publishedDates: string[];
  text: string;
  error: string | null;
};

export function readCachedPage(cacheDir: string, id: string): CachedPage | null {
  const path = join(cacheDir, `${id}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

export async function prefetchAll(
  targets: Array<{ id: string; url: string }>,
  opts: {
    cacheDir: string;
    fetchPage: (url: string) => Promise<FetchedPage>;
    today: string;
    concurrency?: number;
    perHostGapMs?: number;
  },
): Promise<{ fetched: number; cached: number; failed: number }> {
  const { cacheDir, fetchPage, today, concurrency = 4, perHostGapMs = 1000 } = opts;
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('concurrency must be a positive integer');
  if (!Number.isFinite(perHostGapMs) || perHostGapMs < 0) throw new Error('perHostGapMs must be non-negative');
  mkdirSync(cacheDir, { recursive: true });
  const counts = { fetched: 0, cached: 0, failed: 0 };
  // Each host belongs to exactly one worker, so its requests cannot overlap.
  const hosts = new Map<string, typeof targets>();
  for (const target of targets) {
    const host = new URL(target.url).hostname;
    const group = hosts.get(host) ?? [];
    group.push(target);
    hosts.set(host, group);
  }
  const groups = [...hosts.values()];
  let next = 0;
  async function worker(): Promise<void> {
    while (next < groups.length) {
      const group = groups[next++];
      let lastStart = -Infinity;
      for (const target of group) {
        const path = join(cacheDir, `${target.id}.json`);
        if (existsSync(path)) {
          counts.cached++;
          continue;
        }
        while (performance.now() - lastStart < perHostGapMs) {
          await delay(perHostGapMs - (performance.now() - lastStart));
        }
        const cached: CachedPage = {
          ...target, fetchedOn: today, status: 0, contentType: '', finalUrl: target.url,
          publishedDates: [], text: '', error: null,
        };
        lastStart = performance.now();
        try {
          const page = await fetchPage(target.url);
          Object.assign(cached, {
            status: page.status, contentType: page.contentType, finalUrl: page.finalUrl,
            publishedDates: publishedDates(page.html), text: htmlToText(page.html),
          });
          counts.fetched++;
        } catch (error) {
          cached.error = error instanceof Error ? error.message : String(error);
          counts.failed++;
        }
        // A crash leaves only a .tmp file, which a retry can safely replace.
        writeFileSync(path + '.tmp', JSON.stringify(cached, null, 2) + '\n');
        renameSync(path + '.tmp', path);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, groups.length) }, () => worker()));
  return counts;
}
