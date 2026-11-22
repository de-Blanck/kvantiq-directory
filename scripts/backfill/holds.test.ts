import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { recordHolds } from './holds';
import { readHeldList } from '../events/run';
import { eventSchema } from '../../src/lib/events/schema';

const hold = { entities: ['companies/a'], sourceUrl: 'https://example.com/a', reason: 'not-extracted' as const };
test('recordHolds reruns in one ISO week without ageing or storing extraction text', t => {
  const root = mkdtempSync(join(tmpdir(), 'backfill-holds-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(recordHolds(root, [hold], '2026-11-16'), { added: 1, total: 1 });
  assert.deepEqual(recordHolds(root, [hold], '2026-11-22'), { added: 0, total: 1 });
  assert.equal(readHeldList(root)[0].attempts, 1);
  assert.ok(!readFileSync(join(root, 'data/events-held.json'), 'utf8').includes('summary'));
});

test('recordHolds skips complete event coverage, including aliases, but keeps unmatched entities', t => {
  const root = mkdtempSync(join(tmpdir(), 'backfill-holds-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'src/content/events/2026'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  const event = eventSchema.parse({
    schemaVersion: 1, id: 'a-2026-01-01-product-abcdef', entities: hold.entities,
    type: 'product', subtype: null, funding: null, happenedOn: '2026-01-01', foundOn: '2026-01-01',
    summary: 'A product', quote: 'A new quantum product was released.',
    source: { url: hold.sourceUrl, finalUrl: hold.sourceUrl, publisher: 'Example' },
    pointers: [], change: null, origin: 'backfill',
    checks: { checkerVersion: 1, checkedOn: '2026-01-01', sourceLive: true, sourceCredible: true,
      notPointerOnly: true, quoteFound: true, dateFound: true, amountInQuote: null, typeAgreed: true },
  });
  writeFileSync(join(root, 'src/content/events/2026/a.json'), JSON.stringify(event));
  writeFileSync(join(root, 'data/legacy-url-aliases.json'), JSON.stringify({ 'companies/a|https://example.com/': hold.sourceUrl }));
  assert.deepEqual(recordHolds(root, [hold, { ...hold, sourceUrl: 'https://example.com/' }], '2026-11-22'), { added: 0, total: 0 });
  assert.deepEqual(recordHolds(root, [{ ...hold, entities: ['companies/b'] }], '2026-11-22'), { added: 1, total: 1 });
});
