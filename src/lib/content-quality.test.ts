import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateEntry, ratingCounts, MIN_DESCRIPTION_CHARS } from './content-quality.ts';

const long = 'x'.repeat(MIN_DESCRIPTION_CHARS);
const short = 'x'.repeat(MIN_DESCRIPTION_CHARS - 1);

test('a short description makes any entry SPARSE and says by how much', () => {
  const r = rateEntry('resources', { slug: 'a', description: short, lastUpdated: '2026-01-01', maturity: 'stable' });
  assert.equal(r.rating, 'SPARSE');
  assert.match(r.issues[0], /description too short \(79 chars, need 80\+\)/);
});

test('companies need employees or funding, and products plus highlights to be RICH', () => {
  const base = { slug: 'c', description: long };
  assert.equal(rateEntry('companies', base).rating, 'SPARSE');
  assert.equal(rateEntry('companies', { ...base, funding: '€10M' }).rating, 'ADEQUATE');
  assert.equal(
    rateEntry('companies', { ...base, employees: 20, products: ['p'], highlights: ['h'] }).rating,
    'RICH',
  );
});

test('an empty array does not count as present', () => {
  const r = rateEntry('companies', { slug: 'c', description: long, funding: '€1M', products: [], highlights: ['h'] });
  assert.equal(r.rating, 'ADEQUATE');
});

test('challenges report every missing field, not just the first', () => {
  const r = rateEntry('challenges', { slug: 'q', description: long });
  assert.deepEqual(r.issues, ['missing prizes', 'missing dateStart']);
});

test('resources have no required field beyond the description', () => {
  assert.equal(rateEntry('resources', { slug: 'r', description: long }).rating, 'ADEQUATE');
});

test('ratingCounts tallies per collection and omits collections with no entries', () => {
  const rated = [
    rateEntry('companies', { slug: 'a', description: long, funding: '1', products: ['p'], highlights: ['h'] }),
    rateEntry('companies', { slug: 'b', description: long, funding: '1' }),
    rateEntry('companies', { slug: 'c', description: short }),
    rateEntry('resources', { slug: 'd', description: long }),
  ];
  assert.deepEqual(ratingCounts(rated), [
    { collection: 'companies', total: 3, RICH: 1, ADEQUATE: 1, SPARSE: 1 },
    { collection: 'resources', total: 1, RICH: 0, ADEQUATE: 1, SPARSE: 0 },
  ]);
});
