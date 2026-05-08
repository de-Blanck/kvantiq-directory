import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLearningResourceList } from './learning-resource-list.ts';

test('buildLearningResourceList produces ItemList of LearningResource', () => {
  const result = buildLearningResourceList([
    {
      name: 'Qiskit Textbook',
      slug: 'qiskit-textbook',
      description: 'Free open-source quantum textbook.',
      type: 'course',
      website: 'https://qiskit.org/textbook',
      free: true,
      tags: ['course', 'free'],
    },
    {
      name: 'PennyLane',
      slug: 'pennylane',
      description: 'Open-source quantum ML library.',
      type: 'framework',
      website: 'https://pennylane.ai',
      openSource: true,
      tags: ['framework', 'ml'],
    },
  ]);

  assert.equal(result['@type'], 'ItemList');
  assert.equal((result.itemListElement as unknown[]).length, 2);
  const first = (result.itemListElement as Array<Record<string, unknown>>)[0];
  assert.equal(first['@type'], 'ListItem');
  assert.equal(first.position, 1);
  const item = first.item as Record<string, unknown>;
  assert.equal(item['@type'], 'LearningResource');
  assert.equal(item.name, 'Qiskit Textbook');
  assert.equal(item.url, 'https://qiskit.org/textbook');
});
