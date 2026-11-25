// Pure timeline logic for entry pages. The server-only glue lives in load.ts.
import type { EventRecord } from './schema';
import type { MatchResult } from '../../../scripts/backfill/types';

export type LegacyNews = { title: string; excerpt?: string; url: string; source: string; date: string };
export type Timeline = { events: EventRecord[]; earlierNews: LegacyNews[] };

// Amended (Rune, 2026-11-25): no cut-off. Legacy news stays visible under
// "Earlier news" as not yet checked. Only items held for these reasons are
// hidden, because re-extraction (PR 5) is not built and a cut-off would remove
// unchecked news before it could be checked.
export const HIDDEN_LEGACY_REASONS = ['source-unreachable', 'possible-duplicate'] as const;

export function entryTimeline(
  key: string,
  events: EventRecord[],
  news: LegacyNews[],
  match: (entity: string, url: string) => MatchResult,
): Timeline {
  const own = events
    .filter(event => event.entities.includes(key))
    .sort((a, b) => b.happenedOn.localeCompare(a.happenedOn) || a.id.localeCompare(b.id));
  const earlierNews = news.filter(item => {
    const result = match(key, item.url);
    if (result === null) return true;
    if (result.status === 'event') return false;
    return !(HIDDEN_LEGACY_REASONS as readonly string[]).includes(result.reason);
  });
  return { events: own, earlierNews };
}
