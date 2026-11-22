import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const cli = resolve('scripts/backfill/cli.ts');
test('candidates and holds CLI read collection files and preserve outputs on invalid second opinion', t => {
  const root = mkdtempSync(join(tmpdir(), 'backfill-cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path: string, value: unknown) => {
    const file = join(root, '.backfill', path);
    mkdirSync(resolve(file, '..'), { recursive: true });
    writeFileSync(file, JSON.stringify(value));
  };
  const read = (path: string) => JSON.parse(readFileSync(join(root, '.backfill', path), 'utf8'));
  const run = (step: string) => spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), cli, step, '--collection', 'companies', '--today', '2026-11-22'], { cwd: root, encoding: 'utf8' });
  const items = ['fetch', 'pointer-only', 'blocklisted', 'homepage'].map((cls, index) => ({
    id: String(index), url: `https://example.com/${index}`, entities: ['companies/a'], collections: ['companies'],
    resolvedFrom: [], cls, refs: [{ entity: 'companies/a', url: `https://example.com/${index}` }],
    foundOn: '2026-01-01', happenedOnHint: '2026-01-01',
  }));
  write('worklist.json', items);
  write('batches/companies-01.json', [items[0]]);
  write('extracted/companies-01.json', [{ id: '0', status: 'event', entities: ['companies/a'], type: 'product',
    happenedOn: '2026-01-01', summary: 'A product', quote: 'A new quantum product was released.', publisher: 'Example' }]);
  const first = run('candidates');
  assert.equal(first.status, 0, first.stderr);
  assert.equal(read('candidates/companies.json').length, 1);
  assert.equal(read('second-opinion-input/companies.json').length, 1);
  const before = readFileSync(join(root, '.backfill/candidates/companies.json'), 'utf8');
  write('second-opinion/companies.json', [{ id: '0', type: 'product' }, { id: '0', type: 'product' }]);
  assert.equal(run('candidates').status, 1);
  assert.equal(readFileSync(join(root, '.backfill/candidates/companies.json'), 'utf8'), before);
  write('holds/companies-prefetch.json', [{ entities: ['companies/a'], sourceUrl: 'https://example.com/failed', reason: 'source-unreachable' }]);
  write('holds/resources-prefetch.json', [{ entities: ['resources/a'], sourceUrl: 'https://example.com/other', reason: 'source-unreachable' }]);
  const held = run('holds');
  assert.equal(held.status, 0, held.stderr);
  assert.equal(run('holds').status, 0);
  const records = JSON.parse(readFileSync(join(root, 'data/events-held.json'), 'utf8'));
  assert.deepEqual(records.map((record: { reason: string }) => record.reason).sort(), ['homepage-url', 'pointer-only', 'source-not-credible', 'source-unreachable'].sort());
  assert.ok(records.every((record: { attempts: number }) => record.attempts === 1));
});

test('CLI prerequisite helper rejects missing harvest', async t => {
  const { checkPrerequisites } = await import('./prerequisites');
  const root = mkdtempSync(join(tmpdir(), 'backfill-prerequisites-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const step of ['worklist', 'apply', 'reconcile']) {
    assert.throws(() => checkPrerequisites(root, step), /Run the harvest step first: \.backfill\/harvest.json is missing/);
    const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), cli, step, '--collection', 'companies'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Run the harvest step first/);
  }
});

test('worklist prerequisite helper rejects unresolved existing aliases', async t => {
  const { checkPrerequisites } = await import('./prerequisites');
  const root = mkdtempSync(join(tmpdir(), 'backfill-alias-prerequisite-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.backfill'));
  writeFileSync(join(root, '.backfill/harvest.json'), '{}');
  checkPrerequisites(root, 'worklist');
  mkdirSync(join(root, 'data'));
  writeFileSync(join(root, 'data/legacy-url-aliases.json'), '{}');
  checkPrerequisites(root, 'worklist');
  writeFileSync(join(root, 'data/legacy-url-aliases.json'), '{"companies/a|https://example.com/":"https://example.com/a"}');
  assert.throws(() => checkPrerequisites(root, 'worklist'), /homepage-resolved.json is missing/);
  const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), cli, 'worklist'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /homepage-resolved.json is missing/);
  checkPrerequisites(root, 'apply');
  writeFileSync(join(root, '.backfill/homepage-resolved.json'), '[]');
  checkPrerequisites(root, 'worklist');
});

test('listing holds CLI records each entity separately and reconciles both', t => {
  const root = mkdtempSync(join(tmpdir(), 'backfill-listing-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.backfill'));
  mkdirSync(join(root, 'src/content/companies'), { recursive: true });
  const url = 'https://www.hpcwire.com/off-the-wire/';
  const refs = ['pasqal', 'qblox'].map((slug, i) => {
    const ref = { entity: `companies/${slug}`, url, title: 'News', date: ['2026-08-28', '2026-06-25'][i], source: 'HPCwire' };
    writeFileSync(join(root, `src/content/companies/${slug}.json`), JSON.stringify({ news: [ref] }));
    return ref;
  });
  writeFileSync(join(root, '.backfill/worklist.json'), JSON.stringify([{ id: 'listing', url, cls: 'listing', entities: refs.map(ref => ref.entity), collections: ['companies'], refs }]));
  writeFileSync(join(root, '.backfill/harvest.json'), JSON.stringify({ news: [], sources: [], changes: [] }));
  const run = (step: string) => spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), cli, step, '--collection', 'companies'], { cwd: root, encoding: 'utf8' });
  const held = run('holds');
  assert.equal(held.status, 0, held.stderr);
  const records = JSON.parse(readFileSync(join(root, 'data/events-held.json'), 'utf8'));
  assert.equal(records.length, 2);
  assert.ok(records.every((row: { entities: string[]; reason: string }) => row.entities.length === 1 && row.reason === 'homepage-url'));
  const result = run('reconcile');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /held: 2, missing: 0/);
});
