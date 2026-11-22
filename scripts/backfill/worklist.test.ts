import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { eventSchema } from '../../src/lib/events/schema';
import { buildMatcher, loadAliases } from './match';
import { hash12, type Harvest, type LegacyItem } from './types';
import { buildWorklist, pendingItems, recordAliases } from './worklist';

const url = 'https://example.com/n1';

function news(collection: LegacyItem['collection'], slug: string, url: string): LegacyItem {
  return {
    entity: `${collection}/${slug}`, collection, file: `src/content/${collection}/${slug}.json`,
    url, title: 'News', excerpt: null, source: 'Example', date: '2026-05-01',
  };
}

function harvested(...items: LegacyItem[]): Harvest {
  return { refs: [], sources: [], changes: [], news: items.map(item => ({ ...item, refs: ['refresh'], foundOn: '2026-05-02' })) };
}

test('worklist groups across collections, classifies URLs and records homepage aliases on retry', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'backfill-worklist-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const homepages = ['https://www.aqt.eu', 'https://aqt.eu/'];
  const article = 'https://aqt.eu/news/1';
  const items = buildWorklist(root, [], harvested(
    news('challenges', 'c', url + '?utm_medium=example'), news('companies', 'a', url),
    news('companies', 'a', 'https://thequantuminsider.com/x'),
    news('companies', 'a', 'https://news.thequantuminsider.com/'),
    news('companies', 'a', 'https://x.com/n1'),
    news('companies', 'a', homepages[0]), news('companies', 'b', homepages[1]),
    news('companies', 'd', article), news('companies', 'a', 'https://example.com/'),
  ), [{ hid: hash12(homepages[0]), url: article }]);
  const shared = items.find(item => item.id === hash12(url))!;
  assert.deepEqual(shared.entities, ['companies/a', 'challenges/c']);
  assert.deepEqual(shared.collections, ['companies', 'challenges']);
  assert.equal(items.filter(item => item.cls === 'pointer-only').length, 2);
  assert.equal(items.filter(item => item.cls === 'blocklisted').length, 1);
  assert.equal(items.filter(item => item.cls === 'homepage').length, 1);
  const resolved = items.filter(item => item.id === hash12(article));
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].cls, 'fetch');
  assert.deepEqual(resolved[0].resolvedFrom, homepages);
  assert.equal(recordAliases(root, items), 2);
  assert.equal(recordAliases(root, items), 0);
  assert.deepEqual(loadAliases(root), {
    'companies/a|https://aqt.eu/': article,
    'companies/b|https://aqt.eu/': article,
  });
});

test('worklist clamps the first-seen date to the earliest news date', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'backfill-worklist-git-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  function git(...args: string[]): void {
    execFileSync('git', [
      '-C', root, '-c', 'user.name=Test', '-c', 'user.email=test@example.com',
      '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', ...args,
    ], {
      env: { ...process.env, GIT_AUTHOR_DATE: '2026-04-01T12:00:00Z', GIT_COMMITTER_DATE: '2026-04-01T12:00:00Z' },
    });
  }
  git('init', '--initial-branch=main');
  const item = news('companies', 'a', url);
  const homepage = 'https://example.com/';
  mkdirSync(join(root, 'src/content/companies'), { recursive: true });
  writeFileSync(join(root, item.file), JSON.stringify({ name: 'Company A', news: [item, { ...item, url: homepage }] }));
  git('add', item.file);
  git('commit', '-m', 'Add news');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  assert.equal(buildWorklist(root, [item], null, [])[0].foundOn, '2026-05-01');

  function runWorklist(): string {
    return execFileSync(process.execPath, [
      '--import', import.meta.resolve('tsx'), fileURLToPath(new URL('./cli.ts', import.meta.url)), 'worklist',
    ], { cwd: root, encoding: 'utf8' });
  }
  const inputPath = join(root, '.backfill/homepage-input.json');
  const hid = hash12(homepage);
  assert.match(runWorklist(), /homepage: 1/);
  const [input] = JSON.parse(readFileSync(inputPath, 'utf8'));
  assert.equal(input.hid, hid);
  assert.equal(input.url, homepage);
  assert.deepEqual(input.names, ['Company A']);
  assert.equal(input.refs[0].entity, item.entity);

  writeFileSync(join(root, '.backfill/homepage-resolved.json'), JSON.stringify([{ hid, url }]));
  assert.match(runWorklist(), /homepage: 0/);
  assert.deepEqual(JSON.parse(readFileSync(inputPath, 'utf8')), []);
  assert.deepEqual(loadAliases(root), { ['companies/a|' + homepage]: url });
});

test('pending items skip complete coverage and flag only unmatched entities on an existing event', () => {
  const items = buildWorklist('.', [], harvested(news('companies', 'a', url), news('use-cases', 'b', url)), []);
  const event = eventSchema.parse({
    id: 'a-2026-05-01-other-abcdef', schemaVersion: 1, entities: ['companies/a'],
    source: { url, finalUrl: url, publisher: 'Example' }, pointers: [],
    type: 'other', summary: 'Checked news', quote: 'A long enough quote for the fixture.',
    happenedOn: '2026-05-01', foundOn: '2026-05-02', origin: 'backfill',
    change: null, funding: null, subtype: null,
    checks: {
      checkerVersion: 1, checkedOn: '2026-05-02', sourceLive: true, sourceCredible: true,
      notPointerOnly: true, quoteFound: true, dateFound: true, amountInQuote: null, typeAgreed: true,
    },
  });
  assert.deepEqual(pendingItems(items, 'companies', buildMatcher([], [], {}), []), { pending: items, partial: [] });
  assert.deepEqual(pendingItems(items, 'companies', buildMatcher([event], [], {}), [event]), {
    pending: [], partial: [{ entities: ['use-cases/b'], sourceUrl: url, reason: 'possible-duplicate' }],
  });
  const complete = { ...event, entities: ['companies/a', 'use-cases/b'] };
  assert.deepEqual(pendingItems(items, 'use-cases', buildMatcher([complete], [], {}), [complete]), {
    pending: [], partial: [],
  });
});
