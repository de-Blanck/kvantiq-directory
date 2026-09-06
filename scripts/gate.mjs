#!/usr/bin/env node
/**
 * One command that decides whether a change is fit to merge, and says why.
 *
 * Everything automated here needs a single answer to "is this green?", and it
 * has to be the same answer a human would get by hand — otherwise automation
 * drifts from review. So this runs exactly the gates CLAUDE.md names, in order,
 * and stops at the first failure.
 *
 *   npm run gate           type-check, tests, build          (before merging)
 *   npm run gate -- --live adds verify:live                  (after deploying)
 *   npm run gate -- --json machine-readable verdict on stdout
 *
 * --live is deliberately not part of the default run. Before a merge, the
 * deployed site is the *previous* build, so a PR that changes output correctly
 * fails a live comparison; after the deploy of that same commit, it must pass.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PAUSE_FILE = resolve(ROOT, '.automation-paused');

export const STEPS = [
  { name: 'type-check', args: ['run', 'type-check'], live: false },
  { name: 'test', args: ['test'], live: false },
  { name: 'build', args: ['run', 'build'], live: false },
  { name: 'verify:live', args: ['run', 'verify:live'], live: true },
];

export function stepsFor({ live = false } = {}) {
  return STEPS.filter((s) => !s.live || live);
}

/** The kill switch: any automation must stop while this file exists. */
export function pauseReason(file = PAUSE_FILE) {
  if (!existsSync(file)) return null;
  const note = readFileSync(file, 'utf-8').trim();
  return note || 'no reason given';
}

function run(step) {
  const started = Date.now();
  const r = spawnSync('npm', step.args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${r.stdout || ''}${r.stderr || ''}`;
  return {
    name: step.name,
    ok: r.status === 0,
    ms: Date.now() - started,
    // Keep the tail only: enough to explain a failure, small enough to quote
    // into a PR comment or an issue without dumping a build log.
    tail: output.trim().split('\n').slice(-12).join('\n'),
  };
}

export function gate({ live = false } = {}) {
  const results = [];
  for (const step of stepsFor({ live })) {
    const result = run(step);
    results.push(result);
    if (!result.ok) break;
  }
  return { ok: results.every((r) => r.ok), results };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const live = process.argv.includes('--live');
  const asJson = process.argv.includes('--json');

  const paused = pauseReason();
  if (paused) {
    const verdict = { ok: false, paused, results: [] };
    console[asJson ? 'log' : 'error'](
      asJson ? JSON.stringify(verdict, null, 2) : `Gate skipped — automation is paused: ${paused}`,
    );
    process.exit(1);
  }

  const verdict = gate({ live });

  if (asJson) {
    console.log(JSON.stringify(verdict, null, 2));
  } else {
    for (const r of verdict.results) {
      console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name} (${(r.ms / 1000).toFixed(1)}s)`);
      if (!r.ok) console.error(`\n${r.tail}\n`);
    }
    console.log(verdict.ok ? `\nGate passed — ${verdict.results.length} steps.` : '\nGate FAILED.');
  }
  process.exit(verdict.ok ? 0 : 1);
}
