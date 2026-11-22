import type { EventRecord } from '../../src/lib/events/schema';
import type { CachedPage } from './prefetch';
import type { WorkItem } from './types';
import { normalizeUrl } from '../../src/lib/events/url';
import type { HoldReason } from '../events/check';
import { mergeHeld } from '../events/held';
import { readHeldList, writeHeldList } from '../events/run';
import { buildMatcher, eventUrls, loadAliases, loadEventRecords } from './match';

export function recordHolds(
  root: string,
  holds: Array<{ entities: string[]; sourceUrl: string; reason: HoldReason }>,
  today: string,
): { added: number; total: number } {
  const previous = readHeldList(root);
  const match = buildMatcher(loadEventRecords(root), [], loadAliases(root));
  const unresolved = holds.filter(hold => !hold.entities.every(entity => match(entity, hold.sourceUrl)?.status === 'event'));
  const merged = mergeHeld(previous, unresolved, new Set(), today);
  writeHeldList(root, merged);
  return { added: merged.length - previous.length, total: merged.length };
}

export function redirectHolds(
  pending: WorkItem[],
  page: (id: string) => CachedPage | null,
  events: EventRecord[],
  match: ReturnType<typeof buildMatcher>,
): Array<{ entities: string[]; sourceUrl: string; reason: 'possible-duplicate' }> {
  const published = new Set(events.flatMap(eventUrls));
  return pending.flatMap(item => {
    if (item.cls !== 'fetch') return [];
    const cached = page(item.id);
    if (!cached || !published.has(normalizeUrl(cached.finalUrl))) return [];
    const entities = item.entities.filter(entity => match(entity, item.url) === null);
    return entities.length ? [{ entities, sourceUrl: item.url, reason: 'possible-duplicate' as const }] : [];
  });
}
