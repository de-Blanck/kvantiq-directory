import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlocklistedSource, getDomain } from './credibility.mjs';
import { isBlocklistedSource as viaSweep, credibleSourceCount } from '../../scripts/ai-sweep.mjs';

test('credibility: same verdicts as before the move', () => {
  assert.ok(isBlocklistedSource({ url: 'https://www.linkedin.com/company/x', source: 'LinkedIn' }));
  assert.ok(isBlocklistedSource({ url: 'https://example.com/x', source: 'Crunchbase' }));
  assert.ok(isBlocklistedSource({ url: 'https://news.businesswire.com/x', source: '' }));
  assert.ok(!isBlocklistedSource({ url: 'https://www.reuters.com/x', source: 'Reuters' }));
  assert.equal(getDomain('not a url'), '');
});
test('credibility: ai-sweep re-exports the same function and still counts', () => {
  assert.equal(viaSweep, isBlocklistedSource);
  assert.equal(credibleSourceCount([{ url: 'https://reuters.com/a' }, { url: 'https://linkedin.com/b' }]), 1);
});
