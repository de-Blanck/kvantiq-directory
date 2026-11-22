import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { eventSchema } from '../../src/lib/events/schema';
import { buildMatcher, loadEventRecords } from './match';

const url = 'https://example.com/article';
const homepage = 'https://example.com/';

test('matcher loads full event records and checks coverage for pointers, redirects and held aliases', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'backfill-match-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const event = eventSchema.parse({
    id: 'b-2026-01-01-other-abcdef', schemaVersion: 1, entities: ['companies/b', 'companies/a'],
    type: 'other', summary: 'A checked event', quote: 'This is a quote for the checked event.',
    happenedOn: '2026-01-01', foundOn: '2026-01-02', origin: 'backfill',
    source: { url, finalUrl: 'https://example.com/final', publisher: 'Example' },
    pointers: ['https://p.com/x'], change: null, funding: null, subtype: null,
    checks: {
      checkerVersion: 1, checkedOn: '2026-01-02', sourceLive: true, sourceCredible: true,
      notPointerOnly: true, quoteFound: true, dateFound: true, amountInQuote: null, typeAgreed: true,
    },
  });
  const year = join(root, 'src/content/events/2026');
  mkdirSync(year, { recursive: true });
  writeFileSync(join(year, 'event.json'), JSON.stringify(event));
  writeFileSync(join(year, 'event.json.tmp'), '{');
  const events = loadEventRecords(root);
  assert.deepEqual(events, [event]);
  const match = buildMatcher(events, [{
    key: 'companies/c|' + url, entities: ['companies/c'], sourceUrl: url,
    reason: 'not-extracted', firstHeldOn: '2026-01-02', lastCheckedOn: '2026-01-02', attempts: 1, stale: false,
  }], {
    ['companies/c|' + homepage]: url,
    ['companies/d|' + homepage]: url,
  });

  assert.deepEqual(match('companies/a', 'https://p.com/x?utm_source=pointer'), { status: 'event', eventId: event.id });
  assert.deepEqual(match('companies/b', event.source.finalUrl), { status: 'event', eventId: event.id });
  assert.deepEqual(match('companies/c', homepage), { status: 'held', reason: 'not-extracted' });
  assert.equal(match('companies/d', homepage), null);
  assert.equal(match('companies/c', 'https://p.com/x'), null);
});
