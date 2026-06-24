#!/usr/bin/env node
/**
 * Source-credibility audit.
 *
 * Reports each entry's CREDIBLE source count against the 3-source minimum.
 * "Credible" = a source not on the credibility blocklist (LinkedIn, Crunchbase,
 * Wikipedia, press-wire syndication, etc. — see isBlocklistedSource in ai-sweep.mjs).
 *
 * Informational by default (exit 0). Pass --strict to exit 1 when any entry is
 * below the bar — use that once a collection has been backfilled, before flipping
 * its schema to .min(3).
 *
 * Usage: node scripts/audit-sources.mjs [--strict] [--collection companies]
 */
import fs from 'fs';
import path from 'path';
import { credibleSourceCount } from './ai-sweep.mjs';

const MIN_CREDIBLE = 3;
const CONTENT_DIR = 'src/content';
const COLLECTIONS = ['companies', 'benchmarks', 'use-cases', 'challenges', 'resources'];

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const only = (() => { const i = args.indexOf('--collection'); return i >= 0 ? args[i + 1] : null; })();

let total = 0, belowBar = 0, withBlocklisted = 0;
const failures = [];

for (const c of (only ? [only] : COLLECTIONS)) {
  const dir = path.join(CONTENT_DIR, c);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!('sources' in d)) continue;
    total++;
    const cred = credibleSourceCount(d.sources);
    const blk = (d.sources || []).length - cred;
    if (blk > 0) withBlocklisted++;
    if (cred < MIN_CREDIBLE) {
      belowBar++;
      failures.push({ entry: `${c}/${f}`, credible: cred, total: (d.sources || []).length, blocklisted: blk });
    }
  }
}

console.log(`Source-credibility audit — minimum ${MIN_CREDIBLE} credible sources\n`);
console.log(`Entries audited:          ${total}`);
console.log(`At/above the bar:         ${total - belowBar}`);
console.log(`Below the bar:            ${belowBar}  (${total ? Math.round((belowBar / total) * 100) : 0}%)`);
console.log(`With a blocklisted source ${withBlocklisted}\n`);

if (failures.length) {
  console.log('Entries below the 3-credible-source bar (backfill worklist):');
  for (const x of failures.sort((a, b) => a.credible - b.credible)) {
    console.log(`  ${x.entry.padEnd(48)} ${x.credible} credible / ${x.total} total` + (x.blocklisted ? ` (${x.blocklisted} blocklisted)` : ''));
  }
}

if (strict && belowBar > 0) {
  console.error(`\nFAIL (--strict): ${belowBar} entr${belowBar === 1 ? 'y' : 'ies'} below the ${MIN_CREDIBLE}-credible-source bar.`);
  process.exit(1);
}
