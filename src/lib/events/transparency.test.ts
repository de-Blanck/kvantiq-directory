import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventsSummary, heldRows } from './transparency.ts';
import { HOLD_REASON_LABELS } from './labels.ts';
import type { HeldRecord } from '../../../scripts/events/held.ts';

const heldRecord: HeldRecord = {
  key: 'companies/acme|https://example.com/a',
  entities: ['companies/acme'],
  sourceUrl: 'https://www.example.com/a',
  reason: 'source-unreachable',
  firstHeldOn: '2026-10-01',
  lastCheckedOn: '2026-11-20',
  attempts: 3,
  stale: false,
};
const held = (over: Partial<HeldRecord>): HeldRecord => ({ ...heldRecord, ...over });
const index = { 'companies/acme': { name: 'Acme Quantum', href: '/companies/acme/' } };

test('heldRows never carries text beyond entity, source and reason', () => {
  const leaky = { ...heldRecord, summary: 'SECRET SUMMARY', quote: 'SECRET QUOTE' } as HeldRecord;
  const out = JSON.stringify(heldRows([leaky], index));
  assert.ok(!out.includes('SECRET SUMMARY') && !out.includes('SECRET QUOTE'));
  assert.deepEqual(
    Object.keys(heldRows([leaky], index)[0]).sort(),
    ['entity', 'href', 'reason', 'reasonLabel', 'sourceHost', 'sourceUrl'],
  );
});

test('heldRows resolves known entities and falls back to the key with no href', () => {
  const rows = heldRows([heldRecord, held({ entities: ['companies/ghost'] })], index);
  const known = rows.find(r => r.entity === 'Acme Quantum');
  assert.equal(known?.href, '/companies/acme/');
  assert.equal(known?.sourceHost, 'example.com');
  assert.equal(known?.reasonLabel, HOLD_REASON_LABELS['source-unreachable']);
  const unknown = rows.find(r => r.entity === 'companies/ghost');
  assert.equal(unknown?.href, null);
});

test('heldRows sorts by entity then host', () => {
  const rows = heldRows([
    held({ entities: ['companies/zed'], sourceUrl: 'https://a.com/x' }),
    held({ sourceUrl: 'https://b.com/x' }),
    held({ sourceUrl: 'https://a.com/y' }),
  ], { ...index, 'companies/zed': { name: 'Zed', href: '/companies/zed/' } });
  assert.deepEqual(rows.map(r => `${r.entity}|${r.sourceHost}`), ['Acme Quantum|a.com', 'Acme Quantum|b.com', 'Zed|a.com']);
});

test('eventsSummary counts held by reason and stale', () => {
  const s = eventsSummary(7, [
    held({ reason: 'source-unreachable' }),
    held({ reason: 'source-unreachable', stale: true }),
    held({ reason: 'pointer-only' }),
    held({ reason: 'unknown-entity', stale: true }),
    held({ reason: 'unknown-entity' }),
    held({ reason: 'unknown-entity' }),
  ]);
  assert.equal(s.published, 7);
  assert.equal(s.held, 6);
  assert.equal(s.stale, 2);
  assert.deepEqual(s.byReason, [
    { reason: 'unknown-entity', label: HOLD_REASON_LABELS['unknown-entity'], count: 3 },
    { reason: 'source-unreachable', label: HOLD_REASON_LABELS['source-unreachable'], count: 2 },
    { reason: 'pointer-only', label: HOLD_REASON_LABELS['pointer-only'], count: 1 },
  ]);
});

test('eventsSummary breaks count ties by reason and handles empty', () => {
  const s = eventsSummary(0, [held({ reason: 'source-not-html' }), held({ reason: 'pointer-only' })]);
  assert.deepEqual(s.byReason.map(r => r.reason), ['pointer-only', 'source-not-html']);
  assert.deepEqual(eventsSummary(3, []), { published: 3, held: 0, stale: 0, byReason: [] });
});
