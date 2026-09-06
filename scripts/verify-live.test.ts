import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractMain, extractVar, emptyStates, hash, ROUTES } from './verify-live.mjs';

const page = (body: string) =>
  `<!DOCTYPE html><html><head><title>x</title></head><body><main class="a">${body}</main>` +
  `<script>const timelineData = {"labels":["2026-01-01"],"values":[3]};</script></body></html>`;

test('extractMain takes the rendered body and leaves the head and scripts out', () => {
  const main = extractMain(page('<p>226 entries</p>'));
  assert.ok(main?.startsWith('<main class="a">'));
  assert.ok(main?.endsWith('</main>'));
  assert.ok(!main?.includes('timelineData'), 'the injected script must not be compared');
  assert.ok(!main?.includes('<title>'), 'the head must not be compared');
});

test('extractMain returns null when the page has no main', () => {
  assert.equal(extractMain('<html><body>nothing</body></html>'), null);
});

test('a difference anywhere in the body changes the hash', () => {
  assert.equal(hash(extractMain(page('<p>226</p>'))!), hash(extractMain(page('<p>226</p>'))!));
  assert.notEqual(hash(extractMain(page('<p>226</p>'))!), hash(extractMain(page('<p>225</p>'))!));
});

test('extractVar parses the chart payload and survives a missing one', () => {
  assert.deepEqual(extractVar(page(''), 'timelineData'), { labels: ['2026-01-01'], values: [3] });
  assert.equal(extractVar(page(''), 'missingData'), null);
});

test('emptyStates finds the fallback phrases a page renders when data is gone', () => {
  const found = emptyStates('<p>No coverage data available.</p><p>No events recorded yet.</p><p>226 entries</p>');
  assert.deepEqual([...found].sort(), ['No coverage data available', 'No events recorded yet']);
});

test('every route the check compares is a transparency page', () => {
  assert.ok(ROUTES.length >= 4);
  for (const route of ROUTES) assert.match(route, /^\/transparency\//);
});
