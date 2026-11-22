import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeFetch } from './safe-fetch';

const publicUrl = 'https://example.com/article';
const defaults = { lookup: async () => ['93.184.216.34'], userAgent: 'event-checker-test' };
const failure = (finalUrl: string) => ({ status: 0, contentType: '', html: '', finalUrl });

for (const url of [
  'http://169.254.169.254/latest/meta-data/', 'http://localhost/', 'http://2130706433/',
  'http://0x7f000001/', 'http://0177.0.0.1/', 'http://[::ffff:127.0.0.1]/',
  'http://service.local/', 'http://service.internal/', 'http://service.localhost./',
  'http://intranet/', 'ftp://example.com/', 'http://user:pw@example.com/',
]) {
  test(`rejects ${url} before fetching`, async () => {
    let calls = 0;
    const result = await safeFetch(url, {
      ...defaults,
      fetchImpl: async () => { calls++; return new Response('unexpected'); },
    });
    assert.deepEqual(result, failure(url));
    assert.equal(calls, 0);
  });
}

for (const address of ['10.0.0.5', '100.64.0.1', '::', '::1', 'fc00::1', 'fe80::1', 'ff02::1', '2001:db8::1']) {
  test(`rejects DNS results containing ${address}`, async () => {
    let calls = 0;
    const result = await safeFetch(publicUrl, {
      ...defaults,
      lookup: async () => ['93.184.216.34', address],
      fetchImpl: async () => { calls++; return new Response('unexpected'); },
    });
    assert.deepEqual(result, failure(publicUrl));
    assert.equal(calls, 0);
  });
}

test('rejects a redirect to a private IP before fetching it', async () => {
  const privateUrl = 'http://192.168.1.1/';
  const calls: string[] = [];
  const result = await safeFetch(publicUrl, {
    ...defaults,
    fetchImpl: async (url, init) => {
      calls.push(String(url));
      assert.equal(init?.redirect, 'manual');
      return new Response(null, { status: 302, headers: { Location: privateUrl } });
    },
  });
  assert.deepEqual(result, failure(privateUrl));
  assert.deepEqual(calls, [publicUrl]);
});

test('stops at the sixth redirect and resolves relative locations', async () => {
  const calls: string[] = [];
  const result = await safeFetch(publicUrl, {
    ...defaults,
    fetchImpl: async url => {
      calls.push(String(url));
      return new Response(null, { status: 302, headers: { Location: `/hop-${calls.length}` } });
    },
  });
  assert.deepEqual(result, failure('https://example.com/hop-6'));
  assert.equal(calls.length, 6);
  assert.equal(calls[5], 'https://example.com/hop-5');
});

test('truncates a 3 MB response and cancels the stream', async () => {
  let cancelled = false;
  let remaining = 3;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(1_000_000).fill(97));
      if (--remaining === 0) controller.close();
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const result = await safeFetch(publicUrl, {
    ...defaults, fetchImpl: async () => new Response(body),
  });
  assert.equal(result.status, 200);
  assert.equal(result.html.length, 2_000_000);
  assert.equal(cancelled, true);
});

test('returns a public HTML page with its final URL and sends the user agent', async () => {
  const html = '<p>Article</p>';
  const result = await safeFetch(publicUrl, {
    ...defaults,
    lookup: async () => ['93.184.216.34', '2606:4700::1111'],
    fetchImpl: async (url, init) => {
      assert.equal(new Headers(init?.headers).get('user-agent'), defaults.userAgent);
      return String(url) === publicUrl
        ? new Response(null, { status: 302, headers: { Location: '/final' } })
        : new Response(html, { headers: { 'Content-Type': 'text/html' } });
    },
  });
  assert.deepEqual(result, { status: 200, contentType: 'text/html', html, finalUrl: 'https://example.com/final' });
});

test('timeout covers DNS and prevents a late lookup from triggering a fetch', async () => {
  let completeLookup!: (addresses: string[]) => void;
  const lookup = new Promise<string[]>(resolve => { completeLookup = resolve; });
  let calls = 0;
  assert.deepEqual(await safeFetch(publicUrl, {
    ...defaults,
    timeoutMs: 5,
    lookup: () => lookup,
    fetchImpl: async () => { calls++; return new Response('unexpected'); },
  }), failure(publicUrl));
  completeLookup(['93.184.216.34']);
  await lookup;
  assert.equal(calls, 0);
});
