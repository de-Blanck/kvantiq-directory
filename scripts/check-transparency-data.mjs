#!/usr/bin/env node
/**
 * Build guard for the transparency dashboards.
 *
 * The pages under /transparency/ read JSON from data/generated/ and fall back to
 * an empty array when a file is missing. That fallback is silent: the page still
 * builds, still renders, still gets sitemapped — it just says nothing. The
 * Industry Intelligence page shipped that way and stayed empty in production for
 * months before anyone noticed.
 *
 * This runs after `generate-transparency-data` and turns that silence into a
 * failed build.
 *
 * Presence is not enough. On 2026-09-06 every required file was present and
 * non-empty while the growth chart was wrong: `date_added` came from git history,
 * .vercelignore excludes .git, so in production all 226 entries were dated the
 * build day and the chart was a single point. Nothing failed — the numbers were
 * just false, and only in the one environment nobody builds in by hand.
 *
 * So the checks below assert the generated data against src/content, which is the
 * source of truth in every environment. This script runs inside `prebuild`, so it
 * runs on Vercel too: a build that would ship wrong numbers does not ship at all.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(ROOT, 'data/generated');
const CONTENT = resolve(ROOT, 'src/content');
const LEDGER = resolve(ROOT, 'data/entry-first-seen.json');
const COLLECTIONS = ['companies', 'benchmarks', 'use-cases', 'challenges', 'resources'];
const TODAY = new Date().toISOString().slice(0, 10);

/** Every `collection/slug` on disk — the source of truth the generated data must match. */
function contentKeys() {
  const keys = [];
  for (const collection of COLLECTIONS) {
    const dir = resolve(CONTENT, collection);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      keys.push(`${collection}/${file.slice(0, -'.json'.length)}`);
    }
  }
  return keys;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

const sum = (rows, field) => rows.reduce((t, r) => t + (Number(r[field]) || 0), 0);
const list = (items, n = 5) =>
  items.slice(0, n).join(', ') + (items.length > n ? `, +${items.length - n} more` : '');

// Files a transparency page reads and expects to have content.
const REQUIRED = [
  ['sweep-runs.json',              'the sweep log (/transparency/sweeps/)'],
  ['confidence-distribution.json', 'the audit dashboard + transparency index'],
  ['coverage-map.json',            'the audit dashboard + transparency index'],
  ['audit-summary.json',           'the audit dashboard'],
  ['entry-timeline.json',          'the audit dashboard'],
  ['entry-audits.json',            'the audit dashboard'],
];

// Legitimately empty today; listed so their absence from REQUIRED is a decision
// rather than an oversight. source-effectiveness depends on the sources_checked
// table, which the sweep does not populate yet.
const MAY_BE_EMPTY = ['source-effectiveness.json'];

const problems = [];

for (const [file, usedBy] of REQUIRED) {
  const path = resolve(DIR, file);
  if (!existsSync(path)) {
    problems.push(`${file} is missing — ${usedBy} would render empty.`);
    continue;
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    problems.push(`${file} is not valid JSON (${err.message}) — ${usedBy}.`);
    continue;
  }
  const empty = Array.isArray(parsed) ? parsed.length === 0 : Object.keys(parsed ?? {}).length === 0;
  if (empty) problems.push(`${file} is empty — ${usedBy} would render with no data.`);
}

// ── Invariants: generated data vs src/content ────────────────────────────────
// Each of these compares a number a page renders against the filesystem. They are
// cheap, and they are the only thing standing between a silent data bug and a
// production dashboard that states it confidently.

const keys = contentKeys();
const totalEntries = keys.length;

if (totalEntries === 0) {
  problems.push('src/content holds no entries — every transparency page would render empty.');
} else {
  // The first-seen ledger dates the growth chart. Git history is unavailable in the
  // deploy upload, so a slug missing here is dated the build day — the 2026-09-06 bug.
  const ledger = existsSync(LEDGER) ? readJson(LEDGER) : null;
  if (!ledger) {
    problems.push(
      'data/entry-first-seen.json is missing or unreadable — the growth chart would date every entry the build day.',
    );
  } else {
    const missing = keys.filter((k) => !ledger[k]);
    if (missing.length > 0) {
      problems.push(
        `${missing.length} entr${missing.length === 1 ? 'y is' : 'ies are'} absent from data/entry-first-seen.json ` +
          `and would be dated ${TODAY}: ${list(missing)}. Run \`npm run prebuild\` and commit the ledger.`,
      );
    }
    const future = Object.entries(ledger).filter(([, d]) => d > TODAY);
    if (future.length > 0) {
      problems.push(`entry-first-seen.json holds future dates: ${list(future.map(([k, d]) => `${k}=${d}`))}.`);
    }
  }

  // The growth chart plots entry-timeline.json cumulatively. Every date landing on
  // the build day means date_added was never resolved.
  const timeline = readJson(resolve(DIR, 'entry-timeline.json')) ?? [];
  if (Array.isArray(timeline) && timeline.length > 0) {
    if (timeline.every((r) => r.date === TODAY)) {
      problems.push(
        `entry-timeline.json dates every entry ${TODAY} — the growth chart would be a single point.`,
      );
    }
    const timelineTotal = sum(timeline, 'count');
    if (timelineTotal !== totalEntries) {
      problems.push(
        `entry-timeline.json totals ${timelineTotal} entries but src/content holds ${totalEntries} — the growth chart would end on the wrong number.`,
      );
    }
    const badDates = timeline.filter((r) => !/^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '') || r.date > TODAY);
    if (badDates.length > 0) {
      problems.push(`entry-timeline.json holds invalid or future dates: ${list(badDates.map((r) => String(r.date)))}.`);
    }
  }

  // The audit dashboard and the transparency index both render these totals.
  const confidence = readJson(resolve(DIR, 'confidence-distribution.json')) ?? [];
  const confidenceTotal = sum(confidence, 'value');
  if (Array.isArray(confidence) && confidence.length > 0 && confidenceTotal !== totalEntries) {
    problems.push(
      `confidence-distribution.json totals ${confidenceTotal} but src/content holds ${totalEntries} entries.`,
    );
  }

  const coverage = readJson(resolve(DIR, 'coverage-map.json')) ?? [];
  const coverageTotal = sum(coverage, 'count');
  if (Array.isArray(coverage) && coverage.length > 0 && coverageTotal > totalEntries) {
    problems.push(
      `coverage-map.json totals ${coverageTotal} across countries, more than the ${totalEntries} entries that exist.`,
    );
  }

  const audits = readJson(resolve(DIR, 'entry-audits.json')) ?? [];
  if (Array.isArray(audits) && audits.length > 0 && audits.length !== totalEntries) {
    problems.push(
      `entry-audits.json covers ${audits.length} entries but src/content holds ${totalEntries} — detail-page audit history would be missing for some.`,
    );
  }
}

if (problems.length > 0) {
  console.error('\nTransparency data check FAILED:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`
Most of data/generated/ is rebuilt from src/content by the prebuild step, so a
failure here usually means the generator broke rather than that a file was lost.

The exception is sweep-runs.json: it is appended by scripts/ai-sweep.mjs, is
tracked in git, and cannot be reconstructed from anything else. If that is the
missing file, recover it from git rather than regenerating it.
`);
  process.exit(1);
}

console.log(
  `Transparency data check passed — ${REQUIRED.length} required files present and non-empty, ` +
    `and consistent with the ${contentKeys().length} entries in src/content.`,
);
if (MAY_BE_EMPTY.length) console.log(`  (allowed to be empty: ${MAY_BE_EMPTY.join(', ')})`);
