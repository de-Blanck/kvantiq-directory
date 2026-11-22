import assert from 'node:assert/strict';
import test from 'node:test';
import { candidateSchema } from '../events/candidate';
import { buildCandidates, parseModelJson } from './candidates';
import type { BatchEntry } from './batches';
import type { WorkItem } from './types';

const items: WorkItem[] = ['a', 'b'].map(id => ({
  id, url: `https://example.com/${id}`, entities: ['companies/a'], collections: ['companies'],
  resolvedFrom: [], cls: 'fetch', refs: [], happenedOnHint: '2026-01-01', foundOn: '2026-01-01',
}));
const batches: BatchEntry[][] = [items.map(item => ({
  id: item.id, url: item.url, entities: [{ key: 'companies/a', name: 'A', websiteHost: null }],
  refs: [], page: { finalUrl: item.url, publishedDates: [], passages: '' }, selfPublishedPrefix: null,
}))];
const output = (id = 'a') => ({ id, status: 'event', entities: ['companies/a'], type: 'product',
  happenedOn: '2026-02-01', summary: 'A released a product.', quote: 'A released a new quantum product today.', publisher: 'Example' });
function build(raw?: string, second: string | null = null) {
  return buildCandidates(batches, new Map(items.map(item => [item.id, item])), new Map(raw === undefined ? [] : [[0, raw]]), second);
}
const expectedHolds = items.map(item => ({ entities: item.entities, sourceUrl: item.url, reason: 'not-extracted' }));

test('missing, malformed, and non-array extraction holds every batch entry', () => {
  for (const raw of [undefined, 'not json', '{}']) assert.deepEqual(build(raw).holds, expectedHolds);
});

test('model JSON strips one plain or json fence', () => {
  for (const fence of ['```', '```json']) assert.deepEqual(parseModelJson(`${fence}\n[1]\n\x60\x60\x60`), [1]);
  assert.throws(() => parseModelJson('not json'));
  assert.equal(build('```json\n' + JSON.stringify([output(), output('b')]) + '\n```').candidates.length, 2);
});

test('invalid, missing, duplicate and no-event entries are held; unknown ids are ignored', () => {
  for (const rows of [
    [{ ...output(), quote: 'x'.repeat(301) }],
    [{ ...output(), entities: ['companies/a', 'companies/zzz'] }],
    [{ ...output(), extra: true }],
    [{ ...output(), happenedOn: '2026-02-30' }],
    [{ ...output(), type: 'funding' }],
    [{ id: 'a', status: 'no-event', reason: 'No dated event' }],
    [output(), output()], [], [output('unknown')],
  ]) {
    const result = build(JSON.stringify(rows));
    assert.deepEqual(result.holds, expectedHolds);
    assert.deepEqual(result.candidates, []);
  }
  assert.equal(build(JSON.stringify([output(), output('unknown')])).candidates.length, 1);
});

test('valid candidates pass the checker input schema and retain backfill dates and provenance', () => {
  const result = build(JSON.stringify([output(), { ...output('b'), happenedOn: '2025-12-01' }]));
  assert.deepEqual(result.holds, []);
  const candidates = result.candidates.map(candidate => candidateSchema.parse(candidate));
  assert.equal(candidates[0].origin, 'backfill');
  assert.equal(candidates[0].foundOn, '2026-02-01');
  assert.equal(candidates[1].foundOn, '2026-01-01');
  assert.deepEqual(candidates[0].source, { url: items[0].url, publisher: 'Example' });
  assert.deepEqual(candidates[0].pointers, []);
  assert.ok(candidates.every(candidate => !('typeSecondOpinion' in candidate)));
  assert.deepEqual(result.secondOpinionInput, [output(), output('b')].map(({ id, quote, summary }) => ({ id, quote, summary })));
});

test('second opinion rejects malformed, extra-key, invalid-type and duplicate output', () => {
  for (const second of ['not json', '{}', '[{"id":"a","type":"bogus"}]',
    '[{"id":"a","type":"product","extra":true}]',
    '[{"id":"a","type":"product"},{"id":"a","type":"people"}]']) {
    assert.throws(() => build(JSON.stringify([output()]), second));
  }
});

test('second opinion adds matching types and leaves missing ids unchecked', () => {
  const result = build(JSON.stringify([output(), output('b')]), '[{"id":"a","type":"people"}]');
  const candidates = result.candidates.map(candidate => candidateSchema.parse(candidate));
  assert.equal(candidates[0].typeSecondOpinion, 'people');
  assert.ok(!('typeSecondOpinion' in candidates[1]));
});
