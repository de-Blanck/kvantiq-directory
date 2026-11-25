// Pure helpers for the transparency page's events section. Held records carry no summary or
// quote, and heldRows copies only the fields below, so nothing else can reach the page.
import type { HeldRecord } from '../../../scripts/events/held';
import { HOLD_REASON_LABELS } from './labels';

export type EventsSummary = {
  published: number;
  held: number;
  stale: number;
  byReason: { reason: string; label: string; count: number }[];
};

export type HeldRow = {
  entity: string;
  href: string | null;
  sourceUrl: string;
  sourceHost: string;
  reason: string;
  reasonLabel: string;
};

const labelFor = (reason: string): string =>
  (HOLD_REASON_LABELS as Record<string, string>)[reason] ?? reason;

export function eventsSummary(publishedCount: number, held: readonly HeldRecord[]): EventsSummary {
  const counts = new Map<string, number>();
  for (const record of held) counts.set(record.reason, (counts.get(record.reason) ?? 0) + 1);
  const byReason = [...counts].map(([reason, count]) => ({ reason, label: labelFor(reason), count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
  return { published: publishedCount, held: held.length, stale: held.filter(r => r.stale).length, byReason };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function heldRows(
  held: readonly HeldRecord[],
  index: Record<string, { name: string; href: string | null }>,
): HeldRow[] {
  return held.map(record => {
    const key = record.entities[0];
    const known = Object.hasOwn(index, key) ? index[key] : undefined;
    return {
      entity: known?.name ?? key,
      href: known?.href ?? null,
      sourceUrl: record.sourceUrl,
      sourceHost: hostOf(record.sourceUrl),
      reason: record.reason,
      reasonLabel: labelFor(record.reason),
    };
  }).sort((a, b) => a.entity.localeCompare(b.entity) || a.sourceHost.localeCompare(b.sourceHost));
}
