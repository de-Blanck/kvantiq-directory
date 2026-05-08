import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreResponse } from './probe-scoring.ts';

test('cited: response contains directory.kvantiq.studio root URL', () => {
  const result = scoreResponse('Visit https://directory.kvantiq.studio for details.');
  assert.equal(result.label, 'cited');
  assert.equal(result.points, 2);
});

test('cited: response contains directory.kvantiq.studio with path', () => {
  const result = scoreResponse('See https://directory.kvantiq.studio/companies/pasqal/');
  assert.equal(result.label, 'cited');
  assert.equal(result.points, 2);
});

test('cited: matches even without protocol', () => {
  const result = scoreResponse('directory.kvantiq.studio is a great resource.');
  assert.equal(result.label, 'cited');
});

test('mentioned: name without URL — Kvantiq Directory', () => {
  const result = scoreResponse('The Kvantiq Directory tracks European quantum companies.');
  assert.equal(result.label, 'mentioned');
  assert.equal(result.points, 1);
});

test('mentioned: name without URL — Kvantiq Studio', () => {
  const result = scoreResponse('Kvantiq Studio publishes industry data.');
  assert.equal(result.label, 'mentioned');
  assert.equal(result.points, 1);
});

test('mentioned: case-insensitive', () => {
  const result = scoreResponse('kvantiq studio is a small Danish company.');
  assert.equal(result.label, 'mentioned');
});

test('absent: no mention or URL', () => {
  const result = scoreResponse('European quantum companies include Pasqal, IQM, and Quandela.');
  assert.equal(result.label, 'absent');
  assert.equal(result.points, 0);
});

test('cited beats mentioned: response with both gets cited', () => {
  const result = scoreResponse('See Kvantiq Studio at https://directory.kvantiq.studio.');
  assert.equal(result.label, 'cited');
});

test('absent: empty string', () => {
  const result = scoreResponse('');
  assert.equal(result.label, 'absent');
});

test('false-positive guard: a different kvantiq URL does not count', () => {
  // We score on directory subdomain specifically; the marketing site is out of scope
  const result = scoreResponse('Visit https://kvantiq.studio for the platform.');
  assert.equal(result.label, 'mentioned'); // brand mention only, not the directory itself
});
