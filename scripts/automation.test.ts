import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stepsFor, pauseReason } from './gate.mjs';
import { isEligible, blockedPaths, NEVER_AUTOMERGE } from './auto-merge.mjs';

const pr = (over = {}) => ({
  number: 1, title: 'x', labels: [], isDraft: false, mergeable: 'MERGEABLE',
  author: { login: 'de-Blanck' }, files: [{ path: 'src/lib/x.ts' }], ...over,
});

test('the gate leaves the live comparison out unless asked', () => {
  assert.deepEqual(stepsFor().map((s) => s.name), ['type-check', 'test', 'build']);
  assert.ok(stepsFor({ live: true }).map((s) => s.name).includes('verify:live'));
});

test('the pause file stops automation and carries its reason', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  const file = join(dir, '.automation-paused');
  assert.equal(pauseReason(file), null);
  writeFileSync(file, '  investigating a bad deploy  ');
  assert.equal(pauseReason(file), 'investigating a bad deploy');
  writeFileSync(file, '');
  assert.equal(pauseReason(file), 'no reason given', 'an empty file still pauses');
  rmSync(dir, { recursive: true, force: true });
});

test('an unlabelled human PR is never eligible', () => {
  assert.equal(isEligible(pr()).ok, false);
});

test('a labelled PR is eligible, and Dependabot needs no label', () => {
  assert.equal(isEligible(pr({ labels: [{ name: 'auto-merge' }] })).ok, true);
  assert.equal(isEligible(pr({ author: { login: 'app/dependabot' } })).ok, true);
});

test('drafts and conflicts are refused even when labelled', () => {
  assert.equal(isEligible(pr({ labels: [{ name: 'auto-merge' }], isDraft: true })).why, 'draft');
  assert.equal(isEligible(pr({ labels: [{ name: 'auto-merge' }], mergeable: 'CONFLICTING' })).why, 'conflicting');
});

test('the rulebook and the automation itself can never be auto-merged', () => {
  for (const path of ['CLAUDE.md', '.github/workflows/ci.yml', 'scheduler/install-macos.sh', 'scripts/gate.mjs', 'scripts/auto-merge.mjs']) {
    const verdict = isEligible(pr({ labels: [{ name: 'auto-merge' }], files: [{ path }] }));
    assert.equal(verdict.ok, false, `${path} must not be auto-mergeable`);
    assert.match(verdict.why, /review only/);
  }
});

test('blockedPaths matches directories by prefix and files exactly', () => {
  assert.deepEqual(blockedPaths(['.github/workflows/a.yml', 'src/CLAUDE.md.ts', 'CLAUDE.md']), ['.github/workflows/a.yml', 'CLAUDE.md']);
  assert.deepEqual(blockedPaths(['src/pages/index.astro', 'data/entry-first-seen.json']), []);
});

test('the blocklist covers every path that governs what runs on this machine', () => {
  for (const p of ['CLAUDE.md', 'scheduler/', 'scripts/gate.mjs', 'scripts/auto-merge.mjs', '.env']) {
    assert.ok(NEVER_AUTOMERGE.includes(p), `${p} missing from the blocklist`);
  }
});
