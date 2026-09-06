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

// ── Evidence panels ──────────────────────────────────────────────────────────
// What the dashboard shows in place of the confidence score it used to assert:
// how much independent sourcing each entry rests on, and how recently that
// sourcing was actually looked at. Both are counted from the entries themselves.

export interface SourceLike {
  url: string;
  title?: string;
  dateAccessed?: string;
}

/** Ordered bucket keys; the page maps these to the Editorial Light palette. */
export type BucketKey =
  | 'belowBar' | 'atBar' | 'wellSourced' | 'stronglySourced'
  | 'under30' | 'd30to90' | 'd90to180' | 'over180' | 'none';

export interface Bucket {
  key: BucketKey;
  label: string;
  count: number;
}

/**
 * Entries by how many independent credible sources they carry. The bar is a
 * threshold, not a grade: below it an entry is unpublished, and above it the
 * distribution says how far the directory clears its own minimum.
 */
export function sourceStrength(credibleCounts: number[], min = 3): Bucket[] {
  const buckets: Bucket[] = [
    { key: 'belowBar', label: `Below the bar (under ${min})`, count: 0 },
    { key: 'atBar', label: `At the bar (${min})`, count: 0 },
    { key: 'wellSourced', label: `Well sourced (${min + 1}–${min + 2})`, count: 0 },
    { key: 'stronglySourced', label: `Strongly sourced (${min + 3}+)`, count: 0 },
  ];
  for (const n of credibleCounts) {
    if (n < min) buckets[0].count++;
    else if (n === min) buckets[1].count++;
    else if (n <= min + 2) buckets[2].count++;
    else buckets[3].count++;
  }
  return buckets;
}

/** Whole days between two ISO dates, or null if either is unusable. */
export function daysBetween(from: string | undefined | null, to: string): number | null {
  if (!from || !/^\d{4}-\d{2}-\d{2}/.test(from)) return null;
  const start = Date.parse(from.slice(0, 10));
  const end = Date.parse(to.slice(0, 10));
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.floor((end - start) / 86_400_000);
}

/** The most recent of a set of ISO dates, ignoring anything unparseable. */
export function newestDate(dates: (string | undefined | null)[]): string | null {
  const valid = dates.filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}/.test(d)).map((d) => d.slice(0, 10));
  return valid.length > 0 ? valid.sort().at(-1)! : null;
}

/**
 * How long ago each entry was last touched, bucketed. A date in the future is
 * treated as today rather than dropped: it is still evidence, just badly typed.
 */
export function ageDistribution(dates: (string | null)[], today: string, noneLabel = 'None recorded'): Bucket[] {
  const buckets: Bucket[] = [
    { key: 'under30', label: 'Within 30 days', count: 0 },
    { key: 'd30to90', label: '30–90 days', count: 0 },
    { key: 'd90to180', label: '90–180 days', count: 0 },
    { key: 'over180', label: 'Over 180 days', count: 0 },
    { key: 'none', label: noneLabel, count: 0 },
  ];
  for (const date of dates) {
    const days = daysBetween(date, today);
    if (days === null) buckets[4].count++;
    else if (days < 30) buckets[0].count++;
    else if (days < 90) buckets[1].count++;
    else if (days < 180) buckets[2].count++;
    else buckets[3].count++;
  }
  return buckets;
}

export interface DomainRow {
  domain: string;
  entries: number;
  urls: number;
  credible: boolean;
}

export interface DomainConcentration {
  totalUrls: number;
  distinctDomains: number;
  rows: DomainRow[];
}

/**
 * Which outlets the directory leans on, counted by how many distinct entries cite
 * them. Published as a check on itself: a directory that gets a third of its
 * evidence from one outlet is not as independently sourced as its source counts
 * suggest. `isCredible` is passed in so this stays a pure function.
 */
export function sourceConcentration(
  entries: { sources?: SourceLike[] }[],
  isCredible: (source: SourceLike) => boolean,
  limit = 15,
): DomainConcentration {
  const entryCounts = new Map<string, number>();
  const urlCounts = new Map<string, number>();
  const credibility = new Map<string, boolean>();
  let totalUrls = 0;

  for (const entry of entries) {
    const seenHere = new Set<string>();
    for (const source of entry.sources ?? []) {
      const domain = hostname(source.url);
      if (!domain) continue;
      totalUrls++;
      urlCounts.set(domain, (urlCounts.get(domain) ?? 0) + 1);
      credibility.set(domain, isCredible(source));
      if (!seenHere.has(domain)) {
        seenHere.add(domain);
        entryCounts.set(domain, (entryCounts.get(domain) ?? 0) + 1);
      }
    }
  }

  const rows = [...entryCounts.entries()]
    .map(([domain, entriesCiting]) => ({
      domain,
      entries: entriesCiting,
      urls: urlCounts.get(domain) ?? 0,
      credible: credibility.get(domain) ?? true,
    }))
    .sort((a, b) => b.entries - a.entries || a.domain.localeCompare(b.domain));

  return { totalUrls, distinctDomains: rows.length, rows: rows.slice(0, limit) };
}

/** Bare hostname, `www.` stripped. Returns null for anything unparseable. */
export function hostname(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export interface EvidenceSummary {
  /** Sources that count toward the publish bar. */
  credible: number;
  /** Every source listed, credible or not. */
  total: number;
  /** The most recent date any source was accessed. */
  lastAccessed: string | null;
  /** Days since that date, or null when no source records one. */
  days: number | null;
}

/**
 * What a single entry rests on, for the reader looking at that entry.
 *
 * The dashboard shows these two axes across the whole directory; this is the same
 * pair for one entry, so a reader can check the claim against the source list
 * printed directly below it. It is deliberately not combined into a score: the
 * directory had one of those, written as a constant, and it told nobody anything.
 */
export function evidenceSummary(
  sources: SourceLike[] | undefined,
  today: string,
  isCredible: (source: SourceLike) => boolean,
): EvidenceSummary {
  const all = sources ?? [];
  const lastAccessed = newestDate(all.map((s) => s.dateAccessed));
  return {
    credible: all.filter(isCredible).length,
    total: all.length,
    lastAccessed,
    days: daysBetween(lastAccessed, today),
  };
}

/** "today", "yesterday", "18 days ago", "5 months ago" — for a reader, not a machine. */
export function describeAge(days: number | null): string | null {
  if (days === null) return null;
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 45) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months} months ago`;
  return `${Math.round(days / 365)} years ago`;
}
