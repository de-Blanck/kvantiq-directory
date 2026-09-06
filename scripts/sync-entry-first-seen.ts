/**
 * Keeps data/entry-first-seen.json — the date each entry first appeared in the
 * directory, which is the only thing the growth chart on /transparency/audit/ can
 * honestly be plotted from.
 *
 * Git history holds those dates, but the deploy upload excludes .git and Vercel's
 * clone is shallow, so a build cannot ask git. The dates are therefore resolved
 * once, wherever history exists, and committed. The ledger is authoritative: git is
 * consulted only for slugs it has never seen, and a date never moves once written.
 *
 * Runs in `prebuild`. A slug it adds must be committed — the weekly sweep's
 * `git add -A` does that for entries the sweep itself introduces.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const CONTENT_DIR = resolve(ROOT, 'src/content');
const LEDGER_PATH = resolve(ROOT, 'data/entry-first-seen.json');
const TODAY = new Date().toISOString().slice(0, 10);

const COLLECTIONS = ['companies', 'benchmarks', 'use-cases', 'challenges', 'resources'] as const;

type Ledger = Record<string, string>;

function loadLedger(): Ledger {
  if (!existsSync(LEDGER_PATH)) return {};
  try {
    const parsed = JSON.parse(readFileSync(LEDGER_PATH, 'utf-8')) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Ledger;
    console.warn('[first-seen] Ledger is not an object — starting a new one.');
  } catch (err) {
    console.warn(`[first-seen] Could not read the ledger: ${(err as Error).message}`);
  }
  return {};
}

function saveLedger(ledger: Ledger): void {
  const sorted = Object.fromEntries(Object.entries(ledger).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(LEDGER_PATH, JSON.stringify(sorted, null, 2) + '\n');
}

function hasGitHistory(): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      cwd: CONTENT_DIR,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

/** The date a content file was added, from the commit that introduced it. */
function gitCreationDate(filePath: string): string | null {
  try {
    const out = execSync(
      `git log --follow --format=%aI --diff-filter=A -- "${filePath.replace(/\\/g, '/')}"`,
      { encoding: 'utf-8', cwd: CONTENT_DIR },
    ).trim();
    if (!out) return null;
    const lines = out.split('\n');
    return lines[lines.length - 1].slice(0, 10); // oldest commit wins
  } catch {
    return null;
  }
}

function sync(): void {
  const ledger = loadLedger();
  const known = Object.keys(ledger).length;
  const git = hasGitHistory();
  let added = 0;

  for (const collection of COLLECTIONS) {
    const dir = resolve(CONTENT_DIR, collection);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const key = `${collection}/${file.slice(0, -'.json'.length)}`;
      if (ledger[key]) continue;
      ledger[key] = (git ? gitCreationDate(resolve(dir, file)) : null) ?? TODAY;
      added++;
    }
  }

  saveLedger(ledger);
  console.log(
    `[first-seen] ${known} known slugs` +
      (added > 0
        ? `, +${added} dated ${git ? 'from git history' : `${TODAY} (no git history here)`} — commit data/entry-first-seen.json`
        : ', nothing new'),
  );
}

sync();
