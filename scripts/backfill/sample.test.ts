import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EventRecord } from '../../src/lib/events/schema';
import { sampleEvents, sampleMarkdown } from './sample';

function event(id: string, origin: EventRecord['origin'] = 'backfill'): EventRecord {
  return {
    id, origin, schemaVersion: 1, entities: ['companies/a'], type: 'other',
    happenedOn: '2026-11-18', foundOn: '2026-11-22', summary: 'A | B', quote: 'A quote from the article.',
    source: { url: 'https://example.com/article', finalUrl: 'https://example.com/article', publisher: 'Example' },
    change: null, funding: null, subtype: null, pointers: [],
    checks: {
      checkerVersion: 1, checkedOn: '2026-11-22', sourceLive: true, sourceCredible: true, notPointerOnly: true,
      quoteFound: true, dateFound: true, amountInQuote: null, typeAgreed: true,
    },
  };
}

test('sample is deterministic, unique and capped by the backfill pool', () => {
  const pool = ['a', 'b', 'c', 'd'].map(id => event(id));
  const events = [...pool, event('e', 'manual')];
  const sample = sampleEvents(events, 2, 21);
  assert.equal(new Set(sample).size, 2);
  assert.deepEqual(sampleEvents(events, 2, 21), sample);
  assert.deepEqual(new Set(sampleEvents(events, 10, 21)), new Set(pool));
  assert.deepEqual(events.map(({ id }) => id), ['a', 'b', 'c', 'd', 'e']);
});

test('sample markdown includes the requested columns and escapes cell pipes', () => {
  const markdown = sampleMarkdown([event('a')]);
  assert.match(markdown, /Entity \| Type \| Date \| Summary \| Quote \| Source/);
  assert.match(markdown, /companies\/a \| Other \| 2026-11-18 \| A \\\| B/);
  assert.match(markdown, /A quote from the article\./);
  assert.match(markdown, /https:\/\/example\.com\/article/);
});
