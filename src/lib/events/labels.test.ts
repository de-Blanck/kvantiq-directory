import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOLD_REASONS } from '../../../scripts/events/check.ts';
import {
  EVENT_TYPES, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, FUNDING_ROUNDS, FUNDING_ROUND_LABELS, HOLD_REASON_LABELS,
} from './labels.ts';
import * as schema from './schema.ts';

test('every hold reason and funding round has a label', () => {
  for (const reason of HOLD_REASONS) {
    assert.ok(HOLD_REASON_LABELS[reason]?.length > 0, `missing hold label: ${reason}`);
  }
  assert.equal(Object.keys(HOLD_REASON_LABELS).length, HOLD_REASONS.length);
  for (const round of FUNDING_ROUNDS) {
    assert.ok(FUNDING_ROUND_LABELS[round]?.length > 0, `missing round label: ${round}`);
  }
  assert.equal(Object.keys(FUNDING_ROUND_LABELS).length, FUNDING_ROUNDS.length);
  assert.equal(HOLD_REASON_LABELS['pointer-only'], 'Aggregator link supplied as evidence');
});

test('every event type has a label and a distinct hex colour', () => {
  for (const type of EVENT_TYPES) {
    assert.ok(EVENT_TYPE_LABELS[type].length > 0);
    assert.match(EVENT_TYPE_COLORS[type], /^#[0-9A-Fa-f]{6}$/);
  }
  assert.equal(new Set(Object.values(EVENT_TYPE_COLORS)).size, EVENT_TYPES.length);
});

test('schema.ts re-exports the moved constants unchanged', () => {
  assert.equal(schema.EVENT_TYPES, EVENT_TYPES);
  assert.equal(schema.EVENT_TYPE_LABELS, EVENT_TYPE_LABELS);
  assert.equal(schema.FUNDING_ROUNDS, FUNDING_ROUNDS);
});
