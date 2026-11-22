import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { htmlToText } from '../events/page';
import { prefetchAll, readCachedPage } from './prefetch';

const today = '2026-11-22';
const html = '<meta property="article:published_time" content="2026-11-20"><p>A &amp; B</p><script>hidden</script>';
const page = (url: string) => ({ status: 200, contentType: 'text/html', finalUrl: url + '/final', html });

test('prefetch caches extracted pages and skips existing files on rerun', async t => {
  const cacheDir = join(mkdtempSync(join(tmpdir(), 'backfill-prefetch-')), 'pages');
  t.after(() => rmSync(join(cacheDir, '..'), { recursive: true, force: true }));
  const targets = [{ id: 'a', url: 'https://a.example/news' }, { id: 'b', url: 'https://b.example/news' }];
  assert.equal(readCachedPage(cacheDir, 'a'), null);
  assert.deepEqual(await prefetchAll(targets, { cacheDir, today, fetchPage: async url => page(url) }),
    { fetched: 2, cached: 0, failed: 0 });
  assert.deepEqual(readdirSync(cacheDir).sort(), ['a.json', 'b.json']);
  for (const target of targets) {
    assert.deepEqual(readCachedPage(cacheDir, target.id), {
      ...target, fetchedOn: today, status: 200, contentType: 'text/html', finalUrl: target.url + '/final',
      publishedDates: ['2026-11-20'], text: htmlToText(html), error: null,
    });
  }
  const before = readFileSync(join(cacheDir, 'a.json'), 'utf8');
  assert.deepEqual(await prefetchAll(targets, { cacheDir, today, fetchPage: async () => assert.fail('cached page fetched') }),
    { fetched: 0, cached: 2, failed: 0 });
  assert.equal(readFileSync(join(cacheDir, 'a.json'), 'utf8'), before);
});

test('prefetch retries thrown fetches, status 0, 429 and 503 without caching; real answers are cached', async t => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'backfill-prefetch-'));
  t.after(() => rmSync(cacheDir, { recursive: true, force: true }));
  for (const status of ['throw', 0, 429, 503] as const) {
    const target = { id: String(status), url: 'https://example.com/news' };
    let calls = 0;
    for (let run = 0; run < 2; run++) {
      assert.deepEqual(await prefetchAll([target], { cacheDir, today, fetchPage: async url => {
        calls++;
        if (status === 'throw') throw new Error('boom');
        return { ...page(url), status };
      } }), { fetched: 0, cached: 0, failed: 1 });
      assert.equal(readCachedPage(cacheDir, target.id), null);
      assert.deepEqual(readdirSync(cacheDir), []);
    }
    assert.equal(calls, 2);
  }
  for (const status of [403, 404]) {
    const target = { id: String(status), url: 'https://example.com/news' };
    await prefetchAll([target], { cacheDir, today, fetchPage: async url => ({ ...page(url), status }) });
    assert.equal(readCachedPage(cacheDir, target.id)?.status, status);
    assert.deepEqual(await prefetchAll([target], { cacheDir, today, fetchPage: async () => assert.fail('cached') }),
      { fetched: 0, cached: 1, failed: 0 });
  }
});

test('prefetch limits concurrency, serializes each host and spaces request starts', async t => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'backfill-prefetch-'));
  t.after(() => rmSync(cacheDir, { recursive: true, force: true }));
  const targets = ['https://a.example/1', 'https://a.example/2', 'https://b.example/1', 'https://c.example/1']
    .map((url, i) => ({ id: String(i), url }));
  const spans: Array<{ host: string; start: number; end: number }> = [];
  let active = 0;
  let peak = 0;
  await prefetchAll(targets, {
    cacheDir, today, concurrency: 2, perHostGapMs: 60,
    fetchPage: async url => {
      const span = { host: new URL(url).hostname, start: performance.now(), end: Infinity };
      spans.push(span);
      peak = Math.max(peak, ++active);
      await delay(20);
      --active;
      span.end = performance.now();
      return page(url);
    },
  });
  assert.equal(peak, 2);
  const sameHost = spans.filter(span => span.host === 'a.example');
  assert.ok(sameHost[1].start >= sameHost[0].end);
  assert.ok(sameHost[1].start - sameHost[0].start >= 60);
});
