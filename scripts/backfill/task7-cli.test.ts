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
