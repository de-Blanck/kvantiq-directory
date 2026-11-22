import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { applySources } from './apply';
import type { HarvestSource } from './types';

test('apply drops blocked and unavailable sources, appends once and skips duplicates on retry', async t => {
  const root = mkdtempSync(join(tmpdir(), 'backfill-apply-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, 'src/content/companies');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'a.json');
  const before = '{\r\n    "sources" : [\r\n        {"url":"https://example.com/old"}';
  const after = '\r\n    ],\r\n    "news" :[]\r\n}\r\n';
  writeFileSync(path, before + after);

  function harvested(url: string, entity = 'companies/a'): HarvestSource {
    return { entity, source: { type: 'url', url, title: 'Source', dateAccessed: '2026-11-22' }, refs: [] };
  }

  const blocked = harvested('https://www.linkedin.com/company/a');
  const unavailable = harvested('https://example.com/404');
  const credible = harvested('https://www.reuters.com/article/a');
  const fetched: string[] = [];
  async function fetchPage(url: string) {
    fetched.push(url);
    return { status: url === unavailable.source.url ? 404 : 200, finalUrl: url, html: '', contentType: 'text/html' };
  }

  assert.deepEqual(await applySources(root, [blocked, unavailable, credible, harvested(credible.source.url, 'resources/b')],
    'companies', fetchPage), {
    applied: 1,
    dropped: [
      { entity: blocked.entity, url: blocked.source.url, reason: 'blocklisted' },
      { entity: unavailable.entity, url: unavailable.source.url, reason: 'status 404' },
    ],
  });
  const raw = readFileSync(path, 'utf8');
  assert.ok(raw.startsWith(before + ','));
  assert.ok(raw.endsWith(after));
  assert.deepEqual(JSON.parse(raw).sources, [{ url: 'https://example.com/old' }, credible.source]);
  assert.deepEqual(await applySources(root, [credible], 'companies', fetchPage), {
    applied: 0, dropped: [{ entity: credible.entity, url: credible.source.url, reason: 'duplicate' }],
  });
  assert.deepEqual(fetched, [unavailable.source.url, credible.source.url]);
  assert.equal(readFileSync(path, 'utf8'), raw);
});
