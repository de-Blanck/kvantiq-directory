/**
 * The 3-credible-source publish gate.
 *
 * CLAUDE.md -> "Source credibility" sets the bar at three credible sources per
 * entry, and names `isBlocklistedSource` in scripts/ai-sweep.mjs as the canonical
 * definition of "credible". That function is imported here rather than
 * reimplemented, so the site, the sweep and `npm run audit:sources` cannot drift
 * apart on what counts.
 *
 * Entries below the bar are unlisted, not deleted: excluded from every listing,
 * from the sitemap and from the search index, and served noindex with a banner.
 * Their URLs keep working, so nothing already indexed turns into a 404.
 */
import { isBlocklistedSource } from '../../scripts/ai-sweep.mjs';

export const MIN_CREDIBLE_SOURCES = 3;

type SourceLike = { url: string; title?: string };

export function credibleSourceCount(sources: SourceLike[] | undefined): number {
  return (sources || []).filter(
    (s) => !isBlocklistedSource({ url: s.url, source: s.title || '' }),
  ).length;
}

/** True when the entry clears the bar and may appear in listings, sitemap and search. */
export function isPublished(data: { sources?: SourceLike[] }): boolean {
  return credibleSourceCount(data.sources) >= MIN_CREDIBLE_SOURCES;
}

/** Convenience for `getCollection` results. */
export function publishedOnly<T extends { data: { sources?: SourceLike[] } }>(entries: T[]): T[] {
  return entries.filter((e) => isPublished(e.data));
}
