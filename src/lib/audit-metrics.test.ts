import { test } from 'node:test';
import assert from 'node:assert/strict';
import { growthSeries, entriesMissingFromLedger, coverageByCountry, entryKey } from './audit-metrics.ts';

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
