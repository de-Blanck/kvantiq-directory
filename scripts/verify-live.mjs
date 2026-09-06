#!/usr/bin/env node
/**
 * Post-deploy check: does the deployed site render what this build produced?
 *
 * Vercel builds from an upload with no .git and no local database, and until
 * 2026-09-06 nothing ever compared the result against the build that was
 * reviewed. That gap is how the growth chart stayed a single point in production
 * for months while every local build drew it correctly, and how the Industry
 * Intelligence page shipped blank.
 *
 * The comparison is the rendered <main> of each page, hashed. Everything a reader
 * sees is inside it, so this catches any wrong number — not only the ones a probe
 * thought to name. The <head> and Vercel's injected analytics script are excluded
 * because they legitimately differ between a local build and a deployment.
 *
 *   npm run build && npm run verify:live
 *
 * Against a preview rather than production:
 *
 *   LIVE_BASE_URL=https://<deployment>.vercel.app npm run verify:live
 *
 * Preview deployments are behind Deployment Protection. Set
 * VERCEL_AUTOMATION_BYPASS_SECRET (Project Settings → Deployment Protection →
 * Protection Bypass for Automation) and it is sent as the bypass header;
 * without it the check reports the protection rather than pretending the page
 * is empty.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const BASE = process.env.LIVE_BASE_URL ?? 'https://directory.kvantiq.studio';
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

/**
 * Pages whose rendered content must match the build. One of each shape: the
 * transparency dashboards, a listing, an entry detail page, a country page and the
 * homepage — so a change in a shared layout or component is caught, not just a
 * change on the page someone was thinking about.
 */
export const ROUTES = [
  '/',
  '/transparency/',
  '/transparency/audit/',
  '/transparency/intelligence/',
  '/transparency/sweeps/',
  '/companies/',
  '/companies/kvantify/',
  '/companies/country/denmark/',
  '/benchmarks/',
  '/use-cases/',
  '/challenges/',
  '/resources/',
];

/**
 * Astro stamps every hydrated island with a `uid` generated fresh on each build,
 * so two builds of identical source never produce identical HTML on any page
 * carrying a React island. Those ids are build noise, not content: neutralise them
 * so the comparison is about what the page says.
 */
export function normalize(html) {
  return html
    .replace(/(<astro-island\b[^>]*?)\suid="[^"]*"/g, '$1 uid=""')
    .replace(/(<astro-island\b[^>]*?)\sprefix="[^"]*"/g, '$1 prefix=""');
}

/** The rendered page body, without the head or any script Vercel injects. */
export function extractMain(html) {
  const open = html.indexOf('<main');
  if (open === -1) return null;
  const close = html.lastIndexOf('</main>');
  if (close === -1 || close < open) return null;
  return normalize(html.slice(open, close + '</main>'.length));
}

export function hash(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/**
 * Empty states a page falls back to when its data is missing — "No coverage data
 * available.", "No events recorded yet." One that appears live but not in the
 * local build means production lost data this build had.
 */
export function emptyStates(html) {
  return new Set(html.match(/No [^<.]{3,60}(?:available|recorded|yet)/g) ?? []);
}

/** A chart's data, as `define:vars` serialises it: `const timelineData = {...};` */
export function extractVar(html, name) {
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

async function main() {
  const problems = [];

  for (const route of ROUTES) {
    const localPath = resolve(DIST, `.${route}index.html`);
    if (!existsSync(localPath)) {
      problems.push(`${route} — no built page at dist${route}index.html. Run \`npm run build\` first.`);
      continue;
    }
    const local = readFileSync(localPath, 'utf-8');

    let live;
    try {
      const res = await fetch(`${BASE}${route}`, {
        headers: {
          'cache-control': 'no-cache',
          ...(BYPASS ? { 'x-vercel-protection-bypass': BYPASS, 'x-vercel-set-bypass-cookie': 'true' } : {}),
        },
      });
      if (new URL(res.url).host !== new URL(BASE).host) {
        problems.push(
          `${route} — redirected to ${new URL(res.url).host}. That is Deployment Protection, not the site: ` +
            'set VERCEL_AUTOMATION_BYPASS_SECRET, or verify a public URL.',
        );
        continue;
      }
      if (!res.ok) {
        problems.push(`${route} — returned HTTP ${res.status}.`);
        continue;
      }
      live = await res.text();
    } catch (err) {
      problems.push(`${route} — could not be fetched: ${err.message}`);
      continue;
    }

    const localMain = extractMain(local);
    const liveMain = extractMain(live);
    if (!localMain) {
      problems.push(`${route} — the local build has no <main>; the check cannot compare this page.`);
      continue;
    }
    if (!liveMain) {
      problems.push(`${route} — the deployed page has no <main>. It is not rendering this page at all.`);
      continue;
    }

    if (hash(localMain) !== hash(liveMain)) {
      const timelineLocal = JSON.stringify(extractVar(local, 'timelineData'));
      const timelineLive = JSON.stringify(extractVar(live, 'timelineData'));
      const detail =
        timelineLocal !== timelineLive
          ? `\n      chart data differs — built: ${timelineLocal}\n                          live:  ${timelineLive}`
          : `\n      built ${localMain.length} chars (${hash(localMain)}), live ${liveMain.length} chars (${hash(liveMain)})`;
      problems.push(`${route} — rendered content differs.${detail}`);
      continue;
    }

    const built = emptyStates(local);
    const extra = [...emptyStates(live)].filter((m) => !built.has(m));
    if (extra.length > 0) {
      problems.push(`${route} — production renders empty states this build does not: ${extra.join(', ')}.`);
      continue;
    }

    console.log(`  ok  ${route} (${hash(localMain)}, ${built.size} empty state${built.size === 1 ? '' : 's'})`);
  }

  if (problems.length > 0) {
    console.error('\nLive verification FAILED:\n');
    for (const p of problems) console.error(`  - ${p}`);
    console.error(`
The deployed site is rendering something other than the build that was reviewed.
The usual cause is a build step that behaves differently on Vercel than it does
here — the upload has no .git and no local database (see .vercelignore), so
anything derived from those must come from a committed file instead.
`);
    process.exit(1);
  }

  console.log(`\nLive verification passed — ${BASE} matches dist/ on ${ROUTES.length} pages.`);
}

// Importable for tests; only verifies when run directly.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
