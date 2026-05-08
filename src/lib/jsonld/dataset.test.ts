import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDatasetSchema } from './dataset.ts';

test('buildDatasetSchema produces valid Dataset JSON-LD', () => {
  const result = buildDatasetSchema({
    name: 'QAOA on heavy-hex',
    slug: 'qaoa-heavy-hex',
    description: 'Quantum approximate optimization on IBM heavy-hex topology.',
    algorithm: 'QAOA',
    category: 'optimization',
    hardware: 'IBM Heron r2',
    framework: 'Qiskit',
    qubits: 127,
    keyMetrics: [{ metric: 'Approximation ratio', value: '0.83', unit: undefined }],
    significance: 'First sub-10s runtime on >100 qubits.',
    tags: ['optimization', 'ibm'],
  });

  assert.equal(result['@context'], 'https://schema.org');
  assert.equal(result['@type'], 'Dataset');
  assert.equal(result.name, 'QAOA on heavy-hex');
  assert.equal(result.measurementTechnique, 'QAOA');
  assert.equal(result.url, 'https://directory.kvantiq.studio/benchmarks/qaoa-heavy-hex/');
  assert.deepEqual(result.keywords, ['optimization', 'ibm']);
  assert.equal(Array.isArray(result.variableMeasured), true);
  assert.equal((result.variableMeasured as unknown[]).length, 1);
});

test('buildDatasetSchema omits absent optional fields', () => {
  const result = buildDatasetSchema({
    name: 'Minimal benchmark',
    slug: 'minimal',
    description: 'Bare-minimum benchmark with no key metrics.',
    algorithm: 'VQE',
    category: 'chemistry',
    tags: ['vqe'],
  });
  assert.equal('variableMeasured' in result, false);
  assert.equal('hardwareRequirements' in result, false);
});
