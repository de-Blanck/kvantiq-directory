import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderOgSvg } from './og-image-template.ts';

test('renderOgSvg produces SVG with correct dimensions and palette', async () => {
  const svg = await renderOgSvg({
    eyebrow: 'COMPANY',
    heading: 'Pasqal',
    subhead: 'France · Hardware · Founded 2019',
  });
  // satori renders text as vector paths, not literal text — check structure instead
  assert.match(svg, /<svg/);
  assert.match(svg, /width="1200"/);
  assert.match(svg, /height="630"/);
  // Editorial Light background color present
  assert.match(svg, /#F8F6F1/);
  // Accent color (directory.kvantiq.studio watermark) present
  assert.match(svg, /#B45309/);
});

test('renderOgSvg handles long headings without throwing', async () => {
  const svg = await renderOgSvg({
    eyebrow: 'BENCHMARK',
    heading: 'Variational Quantum Eigensolver on heavy-hex topology with classical warm-start',
    subhead: 'IBM · Qiskit · 127 qubits',
  });
  assert.ok(svg.length > 100);
});
