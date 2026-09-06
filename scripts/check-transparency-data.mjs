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
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../data/generated');

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

// The growth chart on /transparency/audit/ plots entry-timeline.json by date. Every
// date collapsing onto the build day means date_added was never resolved — the
// signature of a build with no git history and no first-seen ledger, which is what
// production looked like until 2026-09-06.
const ledgerPath = resolve(DIR, '../entry-first-seen.json');
if (!existsSync(ledgerPath)) {
  problems.push(
    'data/entry-first-seen.json is missing — the growth chart would date every entry the build day.',
  );
} else {
  const timelinePath = resolve(DIR, 'entry-timeline.json');
  if (existsSync(timelinePath)) {
    try {
      const rows = JSON.parse(readFileSync(timelinePath, 'utf-8'));
      const today = new Date().toISOString().slice(0, 10);
      if (Array.isArray(rows) && rows.length > 0 && rows.every((r) => r.date === today)) {
        problems.push(
          `entry-timeline.json dates every entry ${today} — the growth chart would be a single point.`,
        );
      }
    } catch {
      // Already reported as invalid JSON above.
    }
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

console.log(`Transparency data check passed — ${REQUIRED.length} required files present and non-empty.`);
if (MAY_BE_EMPTY.length) console.log(`  (allowed to be empty: ${MAY_BE_EMPTY.join(', ')})`);
