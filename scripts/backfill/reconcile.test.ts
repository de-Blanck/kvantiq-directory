import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { normalizeUrl } from '../../src/lib/events/url';
import { readHeldList, runCheck } from '../events/run';
import { recordHolds } from './holds';
import { scanLegacy } from './legacy';
import { buildMatcher, loadAliases, loadEventRecords } from './match';
import { reconcile } from './reconcile';
import { hash12, type Harvest } from './types';
import { buildWorklist, pendingItems, recordAliases } from './worklist';

const today = '2026-11-22';
const date = '2026-11-18';
const homepage = 'https://tech.eu/';
const article = 'https://tech.eu/2026/11/18/qilimanjaro-raises';
const pointer = 'https://thequantuminsider.com/news';
const unresolved = 'https://example.com/';
const unmatched = 'https://example.org/news';
const html = readFileSync(new URL('../events/fixtures/funding-release.html', import.meta.url), 'utf8');

function setup(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'backfill-reconcile-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  function entry(entity: string, ...urls: string[]) {
    const path = join(root, 'src/content', entity + '.json');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({
      name: 'Qilimanjaro', website: 'https://qilimanjaro.example',
      sources: ['https://tech.eu/a', 'https://www.reuters.com/a', 'https://sifted.eu/a'].map(url => ({ url })),
      news: urls.map(url => ({ url, date, title: 'Funding news', source: 'Example' })),
    }));
  }
  function worklist(legacy: ReturnType<typeof scanLegacy>, resolved: Array<{ hid: string; url: string }>) {
    // The worklist's git lookup sees no history for these fixture files.
    const bin = join(root, 'bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'git'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const previousPath = process.env.PATH;
    process.env.PATH = [bin, previousPath].join(':');
    try {
      return buildWorklist(root, legacy, null, resolved);
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
    }
  }
  async function publish(entities: string[]) {
    const summary = await runCheck({
      root, today, dryRun: false,
      input: [{
        entities, type: 'funding', happenedOn: date, origin: 'backfill', typeSecondOpinion: 'funding',
        summary: 'Qilimanjaro raises €12M in a Series A', source: { url: article, publisher: 'tech.eu' },
        quote: 'Qilimanjaro has raised €12M in a Series A round.',
        funding: { amount: 12_000_000, currency: 'EUR', round: 'series-a', investors: [] },
      }],
      fetchPage: async () => ({ status: 200, contentType: 'text/html', html, finalUrl: article }),
    });
    assert.equal(summary.published.length, 1, JSON.stringify(summary));
    return summary.published[0];
  }
  return { root, entry, publish, worklist };
}

test('reconcile checks every citation, follows aliases to real holds and reports harvested changes', async t => {
  const { root, entry, publish, worklist } = setup(t);
  entry('companies/a', article, pointer, homepage, unresolved, unmatched);
  entry('challenges/c', article);
  const eventId = await publish(['challenges/c', 'companies/a']);
  recordAliases(root, worklist(scanLegacy(root), [
    { hid: hash12(homepage), url: 'https://example.com/held' },
    { hid: hash12(unresolved), url: 'https://example.com/unmatched' },
  ]));
  recordHolds(root, [
    { entities: ['companies/a'], sourceUrl: pointer, reason: 'pointer-only' },
    { entities: ['companies/a'], sourceUrl: 'https://example.com/held', reason: 'quote-not-found' },
  ], today);
  const harvested: Harvest = {
    refs: [], sources: [],
    news: [{ ...scanLegacy(root)[0], refs: ['refresh'], foundOn: today }],
    changes: [{
      entity: 'companies/a', field: 'employees', from: 10, to: 12, ref: 'refresh', headDate: today,
      superseded: [{ ref: 'older', to: 11 }],
    }],
  };
  const result = reconcile(root, harvested);
  assert.deepEqual(result.counts, { event: 3, held: 2, missing: 2 });
  assert.deepEqual(result.rows.filter(row => row.status === 'event').map(row => [row.entity, row.origin, row.eventId]), [
    ['companies/a', 'legacy', eventId], ['challenges/c', 'legacy', eventId], ['companies/a', 'harvest', eventId],
  ]);
  assert.deepEqual(result.rows.filter(row => row.status === 'held').map(row => [row.url, row.reason]), [
    [pointer, 'pointer-only'], [homepage, 'quote-not-found'],
  ]);
  assert.deepEqual(result.rows.filter(row => row.status === 'missing').map(row => row.url), [unresolved, unmatched]);
  assert.deepEqual(result.changes, [
    { entity: 'companies/a', field: 'employees', to: 12, status: 'deferred' },
    { entity: 'companies/a', field: 'employees', to: 11, status: 'superseded' },
  ]);
  assert.deepEqual(reconcile(root, harvested, 'challenges').counts, { event: 1, held: 0, missing: 0 });
  assert.deepEqual(reconcile(root, harvested, 'challenges').changes, []);
});

test('recordAliases records a homepage citation only for the entity that cited it', t => {
  const { root, entry, worklist } = setup(t);
  entry('companies/a', homepage);
  entry('companies/b', article);
  const items = worklist(scanLegacy(root), [{ hid: hash12(homepage), url: article }]);
  assert.equal(recordAliases(root, items), 1);
  assert.deepEqual(loadAliases(root), { ['companies/a|' + homepage]: normalizeUrl(article) });
});

test('a resolved legacy homepage reconciles after publication without a partial hold', async t => {
  const { root, entry, publish, worklist } = setup(t);
  entry('companies/a', homepage);
  const items = worklist(scanLegacy(root), [{ hid: hash12(homepage), url: article }]);
  recordAliases(root, items);
  const eventId = await publish(['companies/a']);
  const events = loadEventRecords(root);
  const match = buildMatcher(events, readHeldList(root), loadAliases(root));
  const { pending, partial } = pendingItems(items, 'companies', match, events);
  assert.deepEqual(pending, []);
  assert.deepEqual(partial, []);
  recordHolds(root, partial, today);
  assert.deepEqual(readHeldList(root), []);
  assert.deepEqual(reconcile(root, null, 'companies'), {
    rows: [{ entity: 'companies/a', url: homepage, origin: 'legacy', status: 'event', eventId }],
    counts: { event: 1, held: 0, missing: 0 }, changes: [],
  });
});

test('reconcile CLI prints missing rows and exits 1', t => {
  const { root, entry } = setup(t);
  entry('companies/a', unmatched);
  const result = spawnSync(process.execPath, [
    '--import', import.meta.resolve('tsx'), fileURLToPath(new URL('./cli.ts', import.meta.url)),
    'reconcile', '--collection', 'companies',
  ], { cwd: root, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /missing: 1/);
  assert.match(result.stdout, /companies\/a.*https:\/\/example\.org\/news/);
});
