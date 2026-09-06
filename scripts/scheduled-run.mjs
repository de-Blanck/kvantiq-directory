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

const FAILURE_ISSUE_TITLE = 'Weekly sweep failed';

// Read the tail of the run log, for the issue body. Best-effort.
function logTail(lines = 25) {
  try {
    return readFileSync(LOG_FILE, 'utf8').trimEnd().split('\n').slice(-lines).join('\n');
  } catch {
    return '(no log available)';
  }
}

/**
 * File a GitHub issue when the run dies.
 *
 * Every fatal path in this script used to end at `process.exit(1)` with the
 * reason in a log file nobody opens. That mattered more than it looks: a
 * completed sweep always appends a run record to sweep-runs.json, which is
 * tracked, so a finished run always produces a PR. A run that dies before that
 * produces nothing — and "no PR" was therefore indistinguishable from "ran fine,
 * nothing to change".
 *
 * Deduped on the title, so a machine that stays broken files one issue rather
 * than one a week. Never throws: the failure path must not fail.
 */
function reportFailure(msg) {
  try {
    const repo = capture('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
    const open = JSON.parse(capture('gh', ['issue', 'list', '--repo', repo, '--state', 'open',
      '--json', 'title,url', '--limit', '50']));
    const existing = open.find((i) => (i.title || '').startsWith(FAILURE_ISSUE_TITLE));
    if (existing) {
      log(`An open failure issue already exists (${existing.url}) — not filing another.`);
      return;
    }

    const bodyPath = path.join(os.tmpdir(), `kvantiq-sweep-failure-${process.pid}.md`);
    const body = [
      `The scheduled weekly sweep failed on ${new Date().toISOString()}.`,
      '',
      '**Reason**',
      '',
      '```',
      msg,
      '```',
      '',
      '**Last lines of the run log**',
      '',
      '```',
      logTail(),
      '```',
      '',
      'Run it by hand to reproduce:',
      '',
      '```',
      'launchctl start com.kvantiq.directory.weekly   # macOS',
      'node scripts/scheduled-run.mjs                 # any machine',
      '```',
      '',
      'This issue is filed once and not repeated while it stays open. Close it once',
      'the cause is fixed, so the next failure is visible again.',
      '',
    ].join('\n');
    writeFileSync(bodyPath, body);
    try {
      const url = capture('gh', ['issue', 'create', '--repo', repo,
        '--title', `${FAILURE_ISSUE_TITLE} — ${dateStamp()}`, '--body-file', bodyPath]);
      log(`Filed failure issue: ${url}`);
    } finally {
      try { rmSync(bodyPath, { force: true }); } catch { /* best-effort cleanup */ }
    }
  } catch (err) {
    // A failure to report the failure is not worth crashing over — but say so,
    // because it means this run is silent after all.
    log(`WARNING: could not file a failure issue (${err && err.message ? err.message : err}). This run is unreported.`);
  }
}

function fail(msg) {
  log(`FATAL: ${msg}`);
  reportFailure(msg);
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

function openPr(repo, branch, partial, drift) {
  const bodyPath = path.join(os.tmpdir(), `kvantiq-sweep-body-${process.pid}.md`);
  const lines = ['## Weekly AI Content Sweep', ''];
  if (partial) {
    lines.push(
      '> ⚠️ **Partial run.** The sweep exited early (timeout, crash, or credit',
      '> exhaustion), but the entries it had already processed are included here.',
      '> Re-running the sweep refreshes everything from current sources.',
      '',
    );
  }
  if (drift) {
    lines.push(
      '> 🔴 **Production does not match `main`.** `npm run verify:live` failed against',
      '> the deployed site while this run built cleanly, so production is stale or is',
      '> rendering different numbers. Details:',
      '>',
      ...drift.split('\n').filter(Boolean).map((l) => `> ${l}`),
      '',
    );
  }
  lines.push(
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
    ...(drift ? ['- [ ] **Production drift above is understood and resolved**'] : []),
    '',
  );
  writeFileSync(bodyPath, lines.join('\n'));
  const title = `content: weekly AI content sweep${partial ? ' (partial)' : ''}`;
  try {
    const url = capture('gh', ['pr', 'create', '--repo', repo, '--base', 'main',
      '--head', branch, '--title', title,
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

  // Best-effort sweep: a timeout, crash, or credit exhaustion partway through
  // must not discard the entries already processed. We still build + PR whatever
  // landed on disk, marked as a partial run.
  let sweepFailed = false;
  try {
    log('Running AI content sweep…');
    stream(process.execPath, ['scripts/ai-sweep.mjs']);
  } catch (err) {
    sweepFailed = true;
    log(`WARNING: sweep exited abnormally (${err.message}). Will PR any completed work.`);
  }

  if (!hasContentChanges()) {
    if (sweepFailed) fail('Sweep failed and produced no content changes — nothing to PR.');
    log('Sweep produced no content changes. Nothing to do.');
    return;
  }

  // A broken build still blocks the PR — intentional, even for a partial run.
  log('Validating build (npm run build)…');
  stream(NPM, ['run', 'build']);

  // With a fresh build on disk, this is the only routine look anything takes at
  // production. It compares the deployed transparency pages against what this build
  // produces: a mismatch means the site is stale, or is rendering different numbers
  // from the same source — which is how the growth chart stayed wrong for months
  // (fixed 2026-09-06). Never fatal: the sweep's content work is still worth a PR,
  // and a drifted production is a review item, not a reason to throw the run away.
  log('Checking production against this build (npm run verify:live)…');
  const live = probe(NPM, ['run', 'verify:live']);
  let drift = null;
  if (!live.ok) {
    // verify-live.mjs writes its findings to stderr; capture() folds that into the
    // thrown message, so the bullet lines are what is worth quoting into the PR.
    const output = live.err?.message ?? '';
    drift = output.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('- ')).join('\n')
      || 'see the runner log';
    log(`WARNING: production does not match this build.\n${drift}`);
  } else {
    log('Production matches this build.');
  }

  const branch = `${SWEEP_BRANCH_PREFIX}-${dateStamp()}`;
  const partialTag = sweepFailed ? ' (partial)' : '';
  log(`Changes found${partialTag}. Opening PR on branch ${branch}…`);
  capture('git', ['checkout', '-b', branch]);
  capture('git', ['add', '-A']);
  // -c commit.gpgsign=false: this repo signs commits with an SSH key, and on at
  // least one machine that key lives in a password-manager agent with nothing on
  // disk. A scheduled job has no agent, so a signed commit fails after the sweep
  // has already done an hour of work. The signature adds nothing here anyway —
  // these commits are authored by an unattended script and are vouched for by the
  // PR review, not by whose key was loaded on the machine that ran it.
  capture('git', ['-c', 'commit.gpgsign=false', 'commit', '-m',
    `content: weekly AI content sweep ${dateStamp()}${partialTag}`]);
  capture('git', ['push', '-u', 'origin', branch]);
  openPr(repo, branch, sweepFailed, drift);

  log(sweepFailed ? '=== Done (partial run — see WARNING above) ===' : '=== Done ===');
}

try {
  main();
} catch (err) {
  fail(err && err.message ? err.message : String(err));
}
