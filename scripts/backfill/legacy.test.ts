import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { scanLegacy } from './legacy';

test('scanLegacy reads every top-level news array in collection order', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'backfill-legacy-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const first = {
    url: 'https://example.com/first', title: 'First', excerpt: 'First item',
    source: 'Example', date: '2026-01-01',
  };
  const second = { ...first, url: 'https://example.com/second', title: 'Second' };
  const third = {
    url: 'https://example.com/third', title: 'Third', source: 'Example', date: '2026-03-01',
  };
  const companyFile = 'src/content/companies/a.json';
  const resourceFile = 'src/content/resources/b.json';
  mkdirSync(join(root, 'src/content/companies'), { recursive: true });
  mkdirSync(join(root, 'src/content/resources'), { recursive: true });
  writeFileSync(join(root, companyFile), `{"news":[${JSON.stringify(first)}],"news":[${JSON.stringify(second)}]}`);
  writeFileSync(join(root, resourceFile), JSON.stringify({ news: [third] }));

  assert.deepEqual(scanLegacy(root), [
    { ...first, entity: 'companies/a', collection: 'companies', file: companyFile },
    { ...second, entity: 'companies/a', collection: 'companies', file: companyFile },
    { ...third, excerpt: null, entity: 'resources/b', collection: 'resources', file: resourceFile },
  ]);
});
