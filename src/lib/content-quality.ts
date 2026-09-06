/**
 * The RICH / ADEQUATE / SPARSE rating, in one place.
 *
 * These rules lived only inside scripts/content-audit.ts, which printed them to
 * stdout and persisted nothing — so a real per-entry measurement the repository
 * already knew how to make was invisible to the site. The rules move here so the
 * CLI and the Audit Dashboard cannot disagree about what "adequate" means, the
 * same reason src/lib/source-bar.ts imports the sweep's blocklist rather than
 * restating it.
 *
 * Thresholds are unchanged from the original script: any issue makes an entry
 * SPARSE, otherwise meeting the collection's richness condition makes it RICH.
 */

export type Rating = 'RICH' | 'ADEQUATE' | 'SPARSE';

export const COLLECTIONS = ['companies', 'benchmarks', 'use-cases', 'challenges', 'resources'] as const;
export type Collection = (typeof COLLECTIONS)[number];

export const MIN_DESCRIPTION_CHARS = 80;

export interface RatedEntry {
  collection: string;
  slug: string;
  rating: Rating;
  issues: string[];
}

type Data = Record<string, unknown>;

const nonEmptyArray = (v: unknown): boolean => Array.isArray(v) && v.length > 0;

interface Rules {
  /** Missing or too-short fields. Any issue makes the entry SPARSE. */
  issues: (data: Data) => string[];
  /** Met on top of a clean entry, makes it RICH. */
  rich: (data: Data) => boolean;
}

const RULES: Record<Collection, Rules> = {
  companies: {
    issues: (d) => (!d.employees && !d.funding ? ['missing both employees and funding'] : []),
    rich: (d) => nonEmptyArray(d.products) && nonEmptyArray(d.highlights),
  },
  benchmarks: {
    issues: (d) => (!d.hardware ? ['missing hardware'] : []),
    rich: (d) => nonEmptyArray(d.keyMetrics) && !!d.significance,
  },
  'use-cases': {
    issues: (d) => (!d.results ? ['missing results'] : []),
    rich: (d) => nonEmptyArray(d.companies),
  },
  challenges: {
    issues: (d) => [
      ...(!d.prizes ? ['missing prizes'] : []),
      ...(!d.dateStart ? ['missing dateStart'] : []),
    ],
    rich: (d) => !!d.eligibility && nonEmptyArray(d.problemDomains),
  },
  resources: {
    issues: () => [],
    rich: (d) => !!d.lastUpdated && !!d.maturity,
  },
};

export function rateEntry(collection: Collection, data: Data): RatedEntry {
  const description = String(data.description || '');
  const issues = [
    ...(description.length < MIN_DESCRIPTION_CHARS
      ? [`description too short (${description.length} chars, need ${MIN_DESCRIPTION_CHARS}+)`]
      : []),
    ...RULES[collection].issues(data),
  ];

  const rating: Rating = issues.length > 0 ? 'SPARSE' : RULES[collection].rich(data) ? 'RICH' : 'ADEQUATE';
  return { collection, slug: String(data.slug ?? ''), rating, issues };
}

export interface RatingCounts {
  collection: string;
  total: number;
  RICH: number;
  ADEQUATE: number;
  SPARSE: number;
}

/** Per-collection tallies in the declared collection order, plus the overall row. */
export function ratingCounts(rated: RatedEntry[]): RatingCounts[] {
  const rows = COLLECTIONS.map((collection) => {
    const inCollection = rated.filter((r) => r.collection === collection);
    return {
      collection,
      total: inCollection.length,
      RICH: inCollection.filter((r) => r.rating === 'RICH').length,
      ADEQUATE: inCollection.filter((r) => r.rating === 'ADEQUATE').length,
      SPARSE: inCollection.filter((r) => r.rating === 'SPARSE').length,
    };
  }).filter((row) => row.total > 0);

  return rows;
}
