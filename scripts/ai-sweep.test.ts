import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNewsItems, isBlocklistedSource, validateDiscoveredSources, planChunk, isQuotaError, readCursor } from './ai-sweep.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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


// --- Rotating chunk ---
// The directory has more entries than one Claude session's quota, so each run
// takes a slice and the next continues from where it stopped.

const entries = Array.from({ length: 10 }, (_, i) => ({ collection: 'c', file: `${i}.json` }));

test('planChunk takes a slice of the requested size', () => {
  const plan = planChunk(entries, 0, 4);
  assert.equal(plan.length, 4);
  assert.deepEqual(plan.map(e => e.file), ['0.json', '1.json', '2.json', '3.json']);
});

test('planChunk wraps past the end so the rotation is continuous', () => {
  const plan = planChunk(entries, 8, 4);
  assert.deepEqual(plan.map(e => e.file), ['8.json', '9.json', '0.json', '1.json']);
});

test('planChunk never returns more entries than exist', () => {
  assert.equal(planChunk(entries, 0, 999).length, 10);
});

test('planChunk handles the degenerate cases', () => {
  assert.deepEqual(planChunk([], 0, 5), []);
  assert.deepEqual(planChunk(entries, 0, 0), []);
});

test('consecutive chunks cover every entry exactly once per cycle', () => {
  const size = 3;
  const seen: string[] = [];
  let cursor = 0;
  for (let run = 0; run < 4; run++) {
    const plan = planChunk(entries, cursor, size);
    seen.push(...plan.map(e => e.file));
    cursor = (cursor + plan.length) % entries.length;
  }
  // 4 runs x 3 = 12 slots over 10 entries: every entry seen, two seen twice.
  assert.equal(new Set(seen).size, 10);
});

// --- Quota detection ---
// A quota error means every later entry fails identically, so the run must stop
// rather than report unchecked entries as having no sources.

test('isQuotaError recognises the session-limit message the sweep actually hit', () => {
  assert.equal(isQuotaError("claude error: claude -p exited with code 1: You've hit your session limit \u00b7 resets 2:10pm"), true);
});

test('isQuotaError recognises related quota wording', () => {
  assert.equal(isQuotaError('usage limit reached'), true);
  assert.equal(isQuotaError('rate limit exceeded'), true);
  assert.equal(isQuotaError('quota exhausted'), true);
});

test('isQuotaError does not fire on ordinary failures', () => {
  assert.equal(isQuotaError('all fetches failed'), false);
  assert.equal(isQuotaError('claude error: claude -p timed out after 60000ms'), false);
  assert.equal(isQuotaError(undefined), false);
});

// --- Cursor ---

test('readCursor reads next_index from the newest run record', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sweep-cursor-'));
  const file = join(dir, 'runs.json');
  writeFileSync(file, JSON.stringify([{ date: '2026-09-05', chunk: { next_index: 60 } }, { date: '2026-09-04', chunk: { next_index: 0 } }]));
  assert.equal(readCursor(file), 60);
});

test('readCursor falls back to 0 when the file is missing or has no cursor', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sweep-cursor-'));
  assert.equal(readCursor(join(dir, 'nope.json')), 0);
  const legacy = join(dir, 'legacy.json');
  writeFileSync(legacy, JSON.stringify([{ date: '2026-06-20' }]));
  assert.equal(readCursor(legacy), 0);
});
