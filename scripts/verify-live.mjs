#!/usr/bin/env node
/**
 * Post-deploy check: does production render the numbers this build produced?
 *
 * Deploys here are manual (`vercel --prod`), the build runs on Vercel from an
 * upload that deliberately omits .git and the local SQLite db, and nothing ever
 * compared the result against the build that was reviewed. That gap is how the
 * growth chart stayed a single point in production for months while every local
 * build drew it correctly (fixed 2026-09-06), and how the Industry Intelligence
 * page shipped empty before that.
 *
 * This diffs the data embedded in the live HTML against the same data in dist/.
 * Run it after every production deploy:
 *
 *   npm run build && vercel --prod --scope synapse-q && npm run verify:live
 *
 * Exits non-zero on any mismatch, so it can gate a deploy script or a cron.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const BASE = process.env.LIVE_BASE_URL ?? 'https://directory.kvantiq.studio';

// Pages to compare, and the chart values each injects into its script. `define:vars`
// serialises those as `const <name> = <json>;` in the built HTML, so they can be read
// back out of both the local file and the live response and diffed exactly.
const PROBES = [
  ['/transparency/audit/', ['timelineData', 'confidenceData']],
  ['/transparency/', []],
  ['/transparency/intelligence/', []],
  ['/transparency/sweeps/', []],
];

// Every transparency page falls back to an empty state when its data is missing —
// "No coverage data available.", "No events recorded yet." — and that fallback is
// the whole failure mode: the page still builds, still renders, still says nothing.
// An empty state that appears live but not in the local build means production lost
// data this build had.
const EMPTY_STATE = /No [^<.]{3,60}?(?:available|recorded|yet)/g;

const emptyStates = (html) => new Set(html.match(EMPTY_STATE) ?? []);

function extract(html, name) {
  // Astro emits `const timelineData = {...};` — match the JSON object that follows.
  const at = html.indexOf(`${name} = `);
  if (at === -1) return null;
  const from = html.indexOf('{', at);
  if (from === -1) return null;
  let depth = 0;
  for (let i = from; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(from, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

const problems = [];

for (const [route, names] of PROBES) {
  const localPath = resolve(DIST, `.${route}index.html`);
  if (!existsSync(localPath)) {
    problems.push(`${route} — no built page at dist${route}index.html. Run \`npm run build\` first.`);
    continue;
  }
  const local = readFileSync(localPath, 'utf-8');

  let live;
  try {
    const res = await fetch(`${BASE}${route}`, { headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) {
      problems.push(`${route} — production returned HTTP ${res.status}.`);
      continue;
    }
    if (new URL(res.url).host !== new URL(BASE).host) {
      problems.push(
        `${route} — request was redirected to ${new URL(res.url).host}. That is Deployment Protection, ` +
          `not the site: verify a public URL, or fetch it with \`vercel curl\`.`,
      );
      continue;
    }
    live = await res.text();
  } catch (err) {
    problems.push(`${route} — could not fetch production: ${err.message}`);
    continue;
  }

  for (const name of names) {
    const expected = extract(local, name);
    const actual = extract(live, name);
    if (expected === null) {
      problems.push(`${route} — ${name} is absent from the local build; the probe is stale.`);
      continue;
    }
    if (actual === null) {
      problems.push(`${route} — ${name} is absent from the live page. It renders nothing there.`);
      continue;
    }
    const e = JSON.stringify(expected);
    const a = JSON.stringify(actual);
    if (e !== a) {
      problems.push(`${route} — ${name} differs.\n      built: ${e}\n      live:  ${a}`);
    } else {
      console.log(`  ok  ${route} ${name}`);
    }
  }

  const builtEmpty = emptyStates(local);
  const liveEmpty = [...emptyStates(live)].filter((m) => !builtEmpty.has(m));
  if (liveEmpty.length > 0) {
    problems.push(
      `${route} — production renders empty states this build does not: ${liveEmpty.map((m) => `"${m}"`).join(', ')}.`,
    );
  } else {
    console.log(`  ok  ${route} empty states (${builtEmpty.size} expected)`);
  }
}

if (problems.length > 0) {
  console.error('\nLive verification FAILED:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`
Production is rendering something other than the build that was reviewed. The
usual cause is a build step that behaves differently on Vercel than it does here
— the upload has no .git and no data/kvantiq.db (see .vercelignore), so anything
derived from those must come from a committed file instead.
`);
  process.exit(1);
}

console.log(`\nLive verification passed — ${BASE} matches dist/.`);
