#!/usr/bin/env node
/**
 * Build guard for the transparency pages.
 *
 * The pages derive their numbers from src/content directly, so they cannot go
 * silently empty the way the Industry Intelligence page once did. Two inputs are
 * not derivable, and this guards those:
 *
 *   data/entry-first-seen.json — when each entry first appeared. Git history holds
 *     the real dates, but the deploy upload excludes .git, so a slug missing here
 *     is a slug the growth chart cannot place. Before the ledger existed, every
 *     entry silently fell back to the build date and the chart was a single point
 *     in production while every local build drew it correctly (fixed 2026-09-06).
 *
 *   data/generated/sweep-runs.json — the sweep history, appended by ai-sweep.mjs.
 *     No build can reconstruct it; recover it from git, never regenerate it.
 *
 * Runs inside `prebuild`, so it runs on Vercel too.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = resolve(ROOT, 'src/content');
const LEDGER = resolve(ROOT, 'data/entry-first-seen.json');
const SWEEPS = resolve(ROOT, 'data/generated/sweep-runs.json');
const COLLECTIONS = ['companies', 'benchmarks', 'use-cases', 'challenges', 'resources'];
const TODAY = new Date().toISOString().slice(0, 10);

const problems = [];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

const keys = [];
for (const collection of COLLECTIONS) {
  const dir = resolve(CONTENT, collection);
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    keys.push(`${collection}/${file.slice(0, -'.json'.length)}`);
  }
}

if (keys.length === 0) {
  problems.push('src/content holds no entries — every transparency page would render empty.');
}

const ledger = existsSync(LEDGER) ? readJson(LEDGER) : null;
if (!ledger) {
  problems.push(
    'data/entry-first-seen.json is missing or unreadable — the growth chart would have nothing to plot.',
  );
} else {
  const missing = keys.filter((k) => !ledger[k]);
  if (missing.length > 0) {
    const shown = missing.slice(0, 5).join(', ') + (missing.length > 5 ? `, +${missing.length - 5} more` : '');
    problems.push(
      `${missing.length} entr${missing.length === 1 ? 'y is' : 'ies are'} absent from data/entry-first-seen.json ` +
        `and would be left off the growth chart: ${shown}. Run \`npm run prebuild\` and commit the ledger.`,
    );
  }
  const future = Object.entries(ledger).filter(([, d]) => d > TODAY);
  if (future.length > 0) {
    problems.push(`entry-first-seen.json holds future dates: ${future.slice(0, 5).map(([k, d]) => `${k}=${d}`).join(', ')}.`);
  }
  const dated = keys.map((k) => ledger[k]).filter(Boolean);
  if (dated.length > 1 && dated.every((d) => d === TODAY)) {
    problems.push(
      `every entry in the ledger is dated ${TODAY} — the growth chart would be a single point. ` +
        'This is what a build with no git history and no committed ledger produces.',
    );
  }
}

const sweeps = existsSync(SWEEPS) ? readJson(SWEEPS) : null;
if (!Array.isArray(sweeps) || sweeps.length === 0) {
  problems.push(
    'data/generated/sweep-runs.json is missing, invalid or empty — the sweep log would render with no data. ' +
      'It is appended by scripts/ai-sweep.mjs and cannot be regenerated: recover it from git.',
  );
}

if (problems.length > 0) {
  console.error('\nTransparency data check FAILED:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('');
  process.exit(1);
}

console.log(
  `Transparency data check passed — ${keys.length} entries, all dated in the first-seen ledger, ` +
    `${sweeps.length} sweep runs on record.`,
);
