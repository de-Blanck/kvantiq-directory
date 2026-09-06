import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  growthSeries, entriesMissingFromLedger, coverageByCountry, entryKey,
  sourceStrength, daysBetween, newestDate, ageDistribution, sourceConcentration, hostname,
} from './audit-metrics.ts';

const ledger = {
  'companies/a': '2026-03-19',
  'companies/b': '2026-03-19',
  'companies/c': '2026-05-01',
  'companies/gone': '2026-04-01',
};

const entries = [
  { collection: 'companies', slug: 'a' },
  { collection: 'companies', slug: 'b' },
  { collection: 'companies', slug: 'c' },
];

test('entryKey matches the ledger key shape', () => {
  assert.equal(entryKey({ collection: 'use-cases', slug: 'fraud-detection' }), 'use-cases/fraud-detection');
});

test('growthSeries accumulates by date, oldest first', () => {
  assert.deepEqual(growthSeries(ledger, entries), [
    { date: '2026-03-19', added: 2, total: 2 },
    { date: '2026-05-01', added: 1, total: 3 },
  ]);
});

test('growthSeries ignores ledger slugs that no longer exist', () => {
  const series = growthSeries(ledger, entries);
  assert.equal(series.at(-1)?.total, entries.length);
  assert.ok(!series.some((p) => p.date === '2026-04-01'), 'the removed entry must not appear');
});

test('growthSeries skips entries the ledger has never seen rather than dating them today', () => {
  const withUnknown = [...entries, { collection: 'companies', slug: 'unknown' }];
  const series = growthSeries(ledger, withUnknown);
  assert.equal(series.at(-1)?.total, 3);
  assert.equal(series.length, 2);
});

test('growthSeries is empty when nothing is known', () => {
  assert.deepEqual(growthSeries({}, entries), []);
});

test('entriesMissingFromLedger names exactly the unplaceable entries', () => {
  const missing = entriesMissingFromLedger(ledger, [...entries, { collection: 'resources', slug: 'x' }]);
  assert.deepEqual(missing, ['resources/x']);
});

test('coverageByCountry counts, sorts by size then name, and omits unset countries', () => {
  assert.deepEqual(
    coverageByCountry([
      { country: 'Denmark' },
      { country: 'Germany' },
      { country: 'Denmark' },
      { country: 'Austria' },
      { country: '  ' },
      {},
      { country: null },
    ]),
    [
      { country: 'Denmark', count: 2 },
      { country: 'Austria', count: 1 },
      { country: 'Germany', count: 1 },
    ],
  );
});

test('sourceStrength splits at the bar, not around it', () => {
  const buckets = sourceStrength([0, 2, 3, 3, 4, 5, 6, 12], 3);
  assert.deepEqual(buckets.map((b) => [b.key, b.count]), [
    ['belowBar', 2],
    ['atBar', 2],
    ['wellSourced', 2],
    ['stronglySourced', 2],
  ]);
});

test('sourceStrength labels follow the configured minimum', () => {
  assert.equal(sourceStrength([], 3)[1].label, 'At the bar (3)');
  assert.equal(sourceStrength([], 2)[2].label, 'Well sourced (3–4)');
});

test('daysBetween counts whole days and rejects junk', () => {
  assert.equal(daysBetween('2026-09-01', '2026-09-06'), 5);
  assert.equal(daysBetween('2026-09-06', '2026-09-06'), 0);
  assert.equal(daysBetween(undefined, '2026-09-06'), null);
  assert.equal(daysBetween('not-a-date', '2026-09-06'), null);
});

test('newestDate picks the latest valid date and ignores the rest', () => {
  assert.equal(newestDate(['2026-01-01', '2026-09-01', undefined, 'nope']), '2026-09-01');
  assert.equal(newestDate([]), null);
  assert.equal(newestDate([undefined, null]), null);
});

test('ageDistribution buckets on the boundaries it claims', () => {
  const today = '2026-09-06';
  const dates = [
    '2026-09-06', // 0 days
    '2026-08-08', // 29 days
    '2026-08-07', // 30 days
    '2026-06-09', // 89 days
    '2026-06-08', // 90 days
    '2026-03-11', // 179 days
    '2026-03-10', // 180 days
    null,
  ];
  assert.deepEqual(ageDistribution(dates, today).map((b) => [b.key, b.count]), [
    ['under30', 2],
    ['d30to90', 2],
    ['d90to180', 2],
    ['over180', 1],
    ['none', 1],
  ]);
});

test('ageDistribution treats a future date as current rather than dropping it', () => {
  const buckets = ageDistribution(['2027-01-01'], '2026-09-06');
  assert.equal(buckets[0].count, 1);
  assert.equal(buckets[4].count, 0);
});

test('hostname strips www and lowercases, and survives junk', () => {
  assert.equal(hostname('https://WWW.Example.com/a/b?c=1'), 'example.com');
  assert.equal(hostname('not a url'), null);
  assert.equal(hostname(undefined), null);
});

test('sourceConcentration counts entries citing a domain, not URLs cited', () => {
  const credible = (s: { url: string }) => !s.url.includes('linkedin.com');
  const result = sourceConcentration(
    [
      { sources: [{ url: 'https://arxiv.org/a' }, { url: 'https://arxiv.org/b' }] },
      { sources: [{ url: 'https://arxiv.org/c' }, { url: 'https://linkedin.com/x' }] },
      { sources: [] },
      {},
    ],
    credible,
  );
  assert.equal(result.totalUrls, 4);
  assert.equal(result.distinctDomains, 2);
  assert.deepEqual(result.rows, [
    { domain: 'arxiv.org', entries: 2, urls: 3, credible: true },
    { domain: 'linkedin.com', entries: 1, urls: 1, credible: false },
  ]);
});

test('sourceConcentration honours the row limit', () => {
  const entries = Array.from({ length: 20 }, (_, i) => ({ sources: [{ url: `https://d${i}.com/x` }] }));
  assert.equal(sourceConcentration(entries, () => true, 5).rows.length, 5);
  assert.equal(sourceConcentration(entries, () => true, 5).distinctDomains, 20);
});
