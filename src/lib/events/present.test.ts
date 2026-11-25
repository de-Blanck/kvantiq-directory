import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fundingLine, dayLabel, monthHeading, parseFilters, filterRows, countryOptions, monthlyCounts, toEventRow,
  type EventRow,
} from './present.ts';
import type { EventRecord } from './schema.ts';

const row = (over: Partial<EventRow>): EventRow => ({
  id: 'x', happenedOn: '2026-11-01', month: 'November 2026', day: '1 Nov', type: 'other',
  entities: [], summary: '', publisher: '', sourceUrl: 'https://example.com/a', funding: null, ...over,
});

const rows: EventRow[] = [
  row({ id: 'f', type: 'funding', happenedOn: '2026-10-15', summary: 'IQM raises a round', publisher: 'TechCrunch',
    entities: [{ name: 'IQM', href: '/companies/iqm/', country: 'Finland' }], funding: 'Series A, €12.0M · Kibo Ventures' }),
  row({ id: 'p', type: 'product', happenedOn: '2026-09-02', summary: 'New benchmark release', publisher: 'Kvantiq Wire',
    entities: [{ name: 'QED-C Suite', href: '/benchmarks/qed-c/', country: null }] }),
  row({ id: 'w', type: 'partnership', happenedOn: '2024-01-10', summary: 'Joint contract signed', publisher: 'Reuters',
    entities: [
      { name: 'IQM', href: '/companies/iqm/', country: 'Finland' },
      { name: 'Quantum Brilliance', href: '/companies/qb/', country: 'Germany' },
    ] }),
];

test('fundingLine', () => {
  assert.equal(fundingLine({ amount: 12_000_000, currency: 'EUR', round: 'series-a', investors: ['Kibo Ventures', 'X'] }), 'Series A, €12.0M · Kibo Ventures');
  assert.equal(fundingLine({ amount: 1_500_000_000, currency: 'USD', round: 'ipo', investors: [] }), 'IPO, $1.5B');
  assert.equal(fundingLine({ amount: 250_000, currency: 'DKK', round: 'grant', investors: [] }), 'Grant, DKK 250,000');
  assert.equal(fundingLine({ amount: null, currency: null, round: 'seed', investors: [] }), 'Seed, undisclosed');
});

test('dates format from the string, not local time', () => {
  assert.equal(dayLabel('2026-11-01'), '1 Nov');
  assert.equal(monthHeading('2026-11-01'), 'November 2026');
});

test('parseFilters falls back on unknown values', () => {
  assert.deepEqual(parseFilters('?type=bogus&country=Atlantis&q=iqm', ['Finland']), { type: 'all', country: '', q: 'iqm' });
  assert.deepEqual(parseFilters('?type=funding&country=Finland', ['Finland']), { type: 'funding', country: 'Finland', q: '' });
});

test('filterRows: type, country (any entity), search, empty result', () => {
  const all = { type: 'all' as const, country: '', q: '' };
  assert.equal(filterRows(rows, all).length, 3);
  assert.deepEqual(filterRows(rows, { ...all, type: 'funding' }).map(r => r.id), ['f']);
  assert.deepEqual(filterRows(rows, { ...all, country: 'Germany' }).map(r => r.id), ['w']);
  assert.deepEqual(filterRows(rows, { ...all, country: 'Finland' }).map(r => r.id), ['f', 'w']);
  assert.ok(!filterRows(rows, { ...all, country: 'Finland' }).some(r => r.id === 'p'));
  assert.deepEqual(filterRows(rows, { ...all, q: 'BENCHMARK RELEASE' }).map(r => r.id), ['p']);
  assert.deepEqual(filterRows(rows, { ...all, q: 'quantum brilliance' }).map(r => r.id), ['w']);
  assert.deepEqual(filterRows(rows, { ...all, q: 'reuters' }).map(r => r.id), ['w']);
  assert.deepEqual(filterRows(rows, { ...all, q: 'kibo' }).map(r => r.id), ['f']);
  assert.deepEqual(filterRows(rows, { ...all, type: 'people' }), []);
});

test('countryOptions lists distinct countries sorted, skipping null', () => {
  assert.deepEqual(countryOptions(rows), ['Finland', 'Germany']);
});

test('monthlyCounts: 24 labels ending at endMonth, events outside the window ignored', () => {
  const { labels, series } = monthlyCounts(rows, '2026-11');
  assert.equal(labels.length, 24);
  assert.equal(labels[0], 'Dec 2024');
  assert.equal(labels[23], 'Nov 2026');
  assert.equal(series.funding.reduce((a, b) => a + b, 0), 1);
  assert.equal(series.funding[22], 1); // Oct 2026
  assert.equal(series.product[21], 1); // Sep 2026
  assert.equal(series.partnership.reduce((a, b) => a + b, 0), 0); // Jan 2024 is outside the window
});

const feedEntities = {
  'companies/iqm': { name: 'IQM', country: 'Finland', href: '/companies/iqm/' },
  'benchmarks/qed-c': { name: 'QED-C Suite', country: null, href: '/benchmarks/qed-c/' },
};
const record = (over: object) => ({
  id: 'iqm-2026-10-15-funding-abc123', happenedOn: '2026-10-15', entities: ['companies/iqm'],
  summary: 'IQM raises a round', source: { url: 'https://a.example/x', finalUrl: 'https://a.example/y', publisher: 'TechCrunch' },
  ...over,
}) as unknown as EventRecord;

test('toEventRow resolves entity names and hrefs from the feed and fills funding only for funding events', () => {
  const funding = toEventRow(
    record({ type: 'funding', funding: { amount: 12_000_000, currency: 'EUR', round: 'series-a', investors: ['Kibo Ventures'] } }),
    feedEntities,
  );
  assert.deepEqual(funding.entities, [{ name: 'IQM', href: '/companies/iqm/', country: 'Finland' }]);
  assert.equal(funding.funding, 'Series A, €12.0M · Kibo Ventures');
  assert.equal(funding.month, 'October 2026');
  assert.equal(funding.day, '15 Oct');
  assert.equal(funding.publisher, 'TechCrunch');
  assert.equal(funding.sourceUrl, 'https://a.example/y');

  const product = toEventRow(record({ type: 'product', entities: ['benchmarks/qed-c'] }), feedEntities);
  assert.equal(product.funding, null);
  assert.deepEqual(product.entities, [{ name: 'QED-C Suite', href: '/benchmarks/qed-c/', country: null }]);
});
