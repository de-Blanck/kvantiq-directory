import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNewsItems, isBlocklistedSource, validateDiscoveredSources } from './ai-sweep.mjs';

const domains = new Set(['example.com']);
const base = {
  title: 'Funding round',
  url: 'https://example.com/news',
  source: 'Example',
  date: '2026-06-01',
};

test('keeps a valid item and preserves a non-empty excerpt (trimmed)', () => {
  const out: Array<Record<string, any>> = normalizeNewsItems([{ ...base, excerpt: '  Raised EUR 10M  ' }], domains);
  assert.equal(out.length, 1);
  assert.equal(out[0].excerpt, 'Raised EUR 10M');
  assert.equal(out[0].title, 'Funding round');
});

test('omits an empty-string excerpt rather than writing "" (the schema-breaking case)', () => {
  const out: Array<Record<string, any>> = normalizeNewsItems([{ ...base, excerpt: '' }], domains);
  assert.equal(out.length, 1);
  assert.ok(!('excerpt' in out[0]), 'excerpt key must be absent, not an empty string');
});

test('omits a whitespace-only excerpt', () => {
  const out: Array<Record<string, any>> = normalizeNewsItems([{ ...base, excerpt: '   ' }], domains);
  assert.equal(out.length, 1);
  assert.ok(!('excerpt' in out[0]));
});

test('keeps an item that has no excerpt field at all', () => {
  const out: Array<Record<string, any>> = normalizeNewsItems([{ ...base }], domains);
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
  const out: Array<Record<string, any>> = normalizeNewsItems([{ ...base, url: 'https://fabricated.test/x' }], domains);
  assert.equal(out.length, 0);
});

test('trims title and source', () => {
  const out: Array<Record<string, any>> = normalizeNewsItems([{ ...base, title: '  Padded  ', source: '  Src  ', excerpt: 'x' }], domains);
  assert.equal(out[0].title, 'Padded');
  assert.equal(out[0].source, 'Src');
});

test('returns [] for non-array input', () => {
  assert.deepEqual(normalizeNewsItems(null, domains), []);
});

test('collapses items that share a URL, keeping the first', () => {
  const out: Array<Record<string, any>> = normalizeNewsItems([
    { ...base, title: 'First story', url: 'https://example.com/x' },
    { ...base, title: 'Second story', url: 'https://example.com/x' },
    { ...base, title: 'Different page', url: 'https://example.com/y' },
  ], domains);
  assert.equal(out.length, 2);
  assert.equal(out[0].title, 'First story');
  assert.equal(out[1].url, 'https://example.com/y');
});

test('isBlocklistedSource flags self-published / low-credibility sources', () => {
  assert.ok(isBlocklistedSource({ url: 'https://www.linkedin.com/company/x', source: 'LinkedIn' }));
  assert.ok(isBlocklistedSource({ url: 'https://example.com/x', source: 'Crunchbase' }));
  assert.ok(isBlocklistedSource({ url: 'https://en.wikipedia.org/wiki/X', source: 'Wikipedia' }));
  assert.ok(!isBlocklistedSource({ url: 'https://www.reuters.com/x', source: 'Reuters' }));
});

test('rejects blocklisted sources even when the domain was fetched (methodology enforcement)', () => {
  const fetched = new Set(['example.com', 'linkedin.com']);
  const out: Array<Record<string, any>> = normalizeNewsItems([
    { ...base, title: 'Legit', url: 'https://example.com/news' },
    { ...base, title: 'Self-published', url: 'https://linkedin.com/company/x', source: 'LinkedIn' },
  ], fetched);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, 'Legit');
});

test('validateDiscoveredSources keeps only credible, live-skipped, de-duped candidates', async () => {
  const data = { name: 'Quobly', sources: [{ url: 'https://quobly.io/' }] };
  const out = await validateDiscoveredSources([
    { url: 'https://www.linkedin.com/company/quobly', title: 'LinkedIn' },        // blocklisted
    { url: 'https://quobly.io', title: 'dup of existing (trailing slash)' },      // duplicate
    { url: 'not-a-url' },                                                          // malformed
    { url: 'ftp://x.com/a' },                                                      // bad protocol
    { url: 'https://www.eu-startups.com/quobly', title: 'EU-Startups', type: 'press-release' },
    { url: 'https://www.eu-startups.com/quobly' },                                // intra-batch dup
  ], data, { checkLive: false });
  assert.equal(out.length, 1);
  assert.equal(out[0].url, 'https://www.eu-startups.com/quobly');
  assert.equal(out[0].type, 'press-release');
});
