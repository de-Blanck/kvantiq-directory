#!/usr/bin/env node
/**
 * Portable weekly runner — Kvantiq Directory AI content sweep.
 *
 * Replaces the GitHub Actions pipeline. Runs on any machine (macOS Intel,
 * macOS Apple Silicon, or Windows) on a weekly schedule via launchd or Task
 * Scheduler. The Claude work bills against the Max subscription through the
 * `claude` CLI — no GitHub Actions minutes, no Anthropic API key.
 *
 * What it does, in order:
 *   1. Preflight: verify required tools + the subscription token are present
 *   2. Sync the working clone cleanly to origin's default branch
 *   3. Dedup guard: if an open weekly-sweep PR already exists, exit (another
 *      machine already ran this week)
 *   4. npm ci
 *   5. Run the AI content sweep (scripts/ai-sweep.mjs) — refreshes each entry's
 *      news strictly from fetched source content
 *   6. If nothing changed, exit cleanly
 *   7. npm run build (validate — never open a PR on a broken build)
 *   8. Branch, commit, push, open a PR via gh. Never merges.
 *
 * Requirements per machine (see docs/scheduled-runner.md):
 *   - Node 22+, git, npm, gh (authenticated), the `claude` CLI
 *   - CLAUDE_CODE_OAUTH_TOKEN in the environment or in a repo-root .env file
 *     (generate with `claude setup-token`)
 *
 * Run manually to test: `node scripts/scheduled-run.mjs`
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, appendFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_FILE = path.join(REPO_ROOT, 'scheduled-run-debug.log'); // gitignored via *-debug.log*
const SWEEP_BRANCH_PREFIX = 'ai-sweep/weekly';
const IS_WIN = process.platform === 'win32';
const NPM = IS_WIN ? 'npm.cmd' : 'npm';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { appendFileSync(LOG_FILE, line + '\n'); } catch { /* logging is best-effort */ }
}

function fail(msg) {
  log(`FATAL: ${msg}`);
  process.exit(1);
}

// Run a command, capturing stdout. Throws on non-zero exit.
function capture(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}: ${(r.stderr || r.stdout || '').trim()}`);
  }
  return (r.stdout || '').trim();
}

// Run a command, streaming output to this process. Throws on non-zero exit.
function stream(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: REPO_ROOT, stdio: 'inherit', env: process.env, ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}`);
}

// Like capture(), but returns { ok } instead of throwing — for soft checks.
function probe(cmd, args) {
  try { capture(cmd, args); return { ok: true }; }
  catch (err) { return { ok: false, err }; }
}

// Minimal .env loader (no dependency). Existing env vars win.
function loadDotEnv() {
  const envPath = path.join(REPO_ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function preflight() {
  loadDotEnv();
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    fail('CLAUDE_CODE_OAUTH_TOKEN is not set. Add it to a repo-root .env file or the environment (run `claude setup-token`).');
  }
  for (const [cmd, args] of [
    ['git', ['--version']],
    [NPM, ['--version']],
    ['gh', ['--version']],
    [IS_WIN ? 'claude.cmd' : 'claude', ['--version']],
  ]) {
    if (!probe(cmd, args).ok) fail(`required tool not found or not working: ${cmd}`);
  }
  if (!probe('gh', ['auth', 'status']).ok) fail('gh is not authenticated. Run `gh auth login`.');
}

function syncToMain() {
  log('Syncing clone to origin default branch…');
  capture('git', ['fetch', 'origin', '--prune']);
  let branch = 'main';
  try {
    branch = capture('git', ['symbolic-ref', 'refs/remotes/origin/HEAD']).split('/').pop() || 'main';
  } catch { /* fall back to main */ }
  capture('git', ['checkout', branch]);
  capture('git', ['reset', '--hard', `origin/${branch}`]);
  capture('git', ['clean', '-fd']); // no -x: preserves gitignored .env and logs
  return branch;
}

function weeklyPrAlreadyOpen(repo) {
  const json = capture('gh', ['pr', 'list', '--repo', repo, '--state', 'open',
    '--json', 'headRefName,title', '--limit', '50']);
  const prs = JSON.parse(json);
  return prs.some((pr) => (pr.headRefName || '').startsWith(SWEEP_BRANCH_PREFIX));
}

function hasContentChanges() {
  const status = capture('git', ['status', '--porcelain']);
  return status.length > 0;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function openPr(repo, branch) {
  const bodyPath = path.join(os.tmpdir(), `kvantiq-sweep-body-${process.pid}.md`);
  writeFileSync(bodyPath, [
    '## Weekly AI Content Sweep',
    '',
    'Automated content-freshness pass. News items are extracted only from each',
    "entry's fetched source pages — never fabricated from model memory.",
    '',
    'Generated by the portable scheduled runner (`scripts/scheduled-run.mjs`),',
    'on the Max subscription. No GitHub Actions.',
    '',
    '**Review checklist:**',
    '- [ ] News items are factual (spot-check 3-5 entries)',
    '- [ ] No fabricated funding rounds or partnerships',
    '- [ ] All news URLs resolve to real pages',
    '- [ ] Build passes locally',
    '',
  ].join('\n'));
  try {
    const url = capture('gh', ['pr', 'create', '--repo', repo, '--base', 'main',
      '--head', branch, '--title', 'content: weekly AI content sweep',
      '--body-file', bodyPath]);
    log(`PR opened: ${url}`);
    // Label is a nicety — never let a missing label fail the run.
    if (!probe('gh', ['pr', 'edit', url, '--add-label', 'ai-sweep']).ok) {
      log('Note: could not add the "ai-sweep" label (it may not exist). Continuing.');
    }
  } finally {
    try { rmSync(bodyPath, { force: true }); } catch { /* best-effort cleanup */ }
  }
}

function main() {
  log('=== Kvantiq Directory weekly runner starting ===');
  preflight();

  const repo = capture('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
  log(`Repo: ${repo}`);

  syncToMain();

  if (weeklyPrAlreadyOpen(repo)) {
    log('An open weekly-sweep PR already exists — another machine already ran. Exiting.');
    return;
  }

  log('Installing dependencies (npm ci)…');
  stream(NPM, ['ci']);

  log('Running AI content sweep…');
  stream(process.execPath, ['scripts/ai-sweep.mjs']);

  if (!hasContentChanges()) {
    log('Sweep produced no content changes. Nothing to do.');
    return;
  }

  log('Validating build (npm run build)…');
  stream(NPM, ['run', 'build']);

  const branch = `${SWEEP_BRANCH_PREFIX}-${dateStamp()}`;
  log(`Changes found. Opening PR on branch ${branch}…`);
  capture('git', ['checkout', '-b', branch]);
  capture('git', ['add', '-A']);
  capture('git', ['commit', '-m', `content: weekly AI content sweep ${dateStamp()}`]);
  capture('git', ['push', '-u', 'origin', branch]);
  openPr(repo, branch);

  log('=== Done ===');
}

try {
  main();
} catch (err) {
  fail(err && err.message ? err.message : String(err));
}
