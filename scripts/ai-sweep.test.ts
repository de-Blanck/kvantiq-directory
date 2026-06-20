import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNewsItems } from './ai-sweep.mjs';

const domains = new Set(['example.com']);
const base = {
  title: 'Funding round',
  url: 'https://example.com/news',
  source: 'Example',
  date: '2026-06-01',
};

test('keeps a valid item and preserves a non-empty excerpt (trimmed)', () => {
  const out = normalizeNewsItems([{ ...base, excerpt: '  Raised EUR 10M  ' }], domains);
  assert.equal(out.length, 1);
  assert.equal(out[0].excerpt, 'Raised EUR 10M');
  assert.equal(out[0].title, 'Funding round');
});

test('omits an empty-string excerpt rather than writing "" (the schema-breaking case)', () => {
  const out = normalizeNewsItems([{ ...base, excerpt: '' }], domains);
  assert.equal(out.length, 1);
  assert.ok(!('excerpt' in out[0]), 'excerpt key must be absent, not an empty string');
});

test('omits a whitespace-only excerpt', () => {
  const out = normalizeNewsItems([{ ...base, excerpt: '   ' }], domains);
  assert.equal(out.length, 1);
  assert.ok(!('excerpt' in out[0]));
});

test('keeps an item that has no excerpt field at all', () => {
  const out = normalizeNewsItems([{ ...base }], domains);
  assert.equal(out.length, 1);
  assert.ok(!('excerpt' in out[0]));
});

test('drops items missing required fields or with a bad date', () => {
  assert.equal(normalizeNewsItems([{ ...base, title: '' }], domains).length, 0);
  assert.equal(normalizeNewsItems([{ ...base, source: undefined }], domains).length, 0);
  assert.equal(normalizeNewsItems([{ ...base, date: '06-01-2026' }], domains).length, 0);
  assert.equal(normalizeNewsItems([{ ...base, title: '   ' }], domains).length, 0);
});

test('drops items whose URL domain was not among the fetched sources (anti-fabrication)', () => {
  const out = normalizeNewsItems([{ ...base, url: 'https://fabricated.test/x' }], domains);
  assert.equal(out.length, 0);
});

test('trims title and source', () => {
  const out = normalizeNewsItems([{ ...base, title: '  Padded  ', source: '  Src  ', excerpt: 'x' }], domains);
  assert.equal(out[0].title, 'Padded');
  assert.equal(out[0].source, 'Src');
});

test('returns [] for non-array input', () => {
  assert.deepEqual(normalizeNewsItems(null, domains), []);
});
