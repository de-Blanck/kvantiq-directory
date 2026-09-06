/**
 * Every number the Audit Dashboard renders, derived from evidence that exists in
 * the repository: the content entries themselves and the committed first-seen
 * ledger. Nothing here reads a database.
 *
 * That is the point. The dashboard previously rendered `current_confidence`, a
 * column written as the literal 'MEDIUM' for all 226 entries at migration time, so
 * the panel was a four-colour scale with one reachable branch. A metric that no
 * function computes is not a metric — so these are pure functions over real fields,
 * each one unit-tested, and the page calls them directly rather than reading a
 * generated file that could quietly go stale or empty.
 */

export interface CountryLike {
  country?: string | null;
}

export interface EntryKey {
  collection: string;
  slug: string;
}

/** `collection/slug` — the key shape used by data/entry-first-seen.json. */
export function entryKey(entry: EntryKey): string {
  return `${entry.collection}/${entry.slug}`;
}

export interface GrowthPoint {
  date: string;
  added: number;
  total: number;
}

/**
 * Cumulative entry count over time, one point per date on which the directory grew.
 *
 * Only entries that still exist are counted: the ledger keeps slugs that have since
 * been removed (a date is never rewritten), but the chart describes the directory as
 * it stands, so a removed entry must not inflate history. An entry missing from the
 * ledger is skipped rather than dated today — dating it today is exactly the bug
 * that made this chart a single point in production.
 */
export function growthSeries(firstSeen: Record<string, string>, entries: EntryKey[]): GrowthPoint[] {
  const perDate = new Map<string, number>();
  for (const entry of entries) {
    const date = firstSeen[entryKey(entry)];
    if (!date) continue;
    perDate.set(date, (perDate.get(date) ?? 0) + 1);
  }

  let total = 0;
  return [...perDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, added]) => {
      total += added;
      return { date, added, total };
    });
}

/** Entries whose first-seen date is unknown — the growth chart cannot place them. */
export function entriesMissingFromLedger(
  firstSeen: Record<string, string>,
  entries: EntryKey[],
): string[] {
  return entries.map(entryKey).filter((key) => !firstSeen[key]).sort();
}

export interface CountryCount {
  country: string;
  count: number;
}

/**
 * Entries per country, most first. Only `companies` carry a country today; the
 * other collections leave it unset, and an unset country is omitted rather than
 * bucketed as "Unknown", which would read as a place.
 */
export function coverageByCountry(entries: CountryLike[]): CountryCount[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const country = entry.country?.trim();
    if (!country) continue;
    counts.set(country, (counts.get(country) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
}
