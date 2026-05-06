// scripts/lib/probe-prompts.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPrompts } from './probe-prompts.ts';

test('loadPrompts returns 30 prompts with version 1', async () => {
  const file = await loadPrompts();
  assert.equal(file.version, '1');
  assert.equal(file.prompts.length, 30);
});

test('loadPrompts: every prompt has unique id', async () => {
  const file = await loadPrompts();
  const ids = new Set(file.prompts.map(p => p.id));
  assert.equal(ids.size, file.prompts.length);
});

test('loadPrompts: covers all 5 dimensions × 6 prompts each', async () => {
  const file = await loadPrompts();
  const counts = file.prompts.reduce<Record<string, number>>((acc, p) => {
    acc[p.dimension] = (acc[p.dimension] ?? 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(counts, { geographic: 6, modality: 6, category: 6, entity: 6, discovery: 6 });
});
