#!/usr/bin/env node
/**
 * Merges pull requests that are provably safe to merge, and nothing else.
 *
 * GitHub Actions cannot run on this repo (billing), so no status check gates a
 * pull request here. That absence is why every merge needed a human today. This
 * closes the gap locally: it runs the same gate a person would run, merges only
 * on green, then confirms the deploy actually rendered what was built.
 *
 * Eligibility is deliberately narrow — a PR qualifies only if it is:
 *   - labelled `auto-merge`, or authored by Dependabot
 *   - mergeable, not draft, not conflicted
 *   - touching no path on the never-touch list below
 *
 * Anything else waits for review. Tier 3 work (design, product direction) is not
 * something a green build can vouch for.
 *
 *   node scripts/auto-merge.mjs --dry-run   decide and explain, change nothing
 *   node scripts/auto-merge.mjs             do it, one PR per run
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pauseReason } from './gate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'de-Blanck/kvantiq-directory';

/**
 * Paths no automated merge may touch, whatever the gate says. The rulebook and
 * the automation's own machinery are governed by review, not by a green build;
 * secrets and scheduler config can change what runs on this machine.
 */
export const NEVER_AUTOMERGE = [
  'CLAUDE.md',
  '.github/',
  'scheduler/',
  'scripts/auto-merge.mjs',
  'scripts/gate.mjs',
  '.env',
  '.vercelignore',
  '.gitignore',
];

export function blockedPaths(files, blocklist = NEVER_AUTOMERGE) {
  return files.filter((f) => blocklist.some((b) => (b.endsWith('/') ? f.startsWith(b) : f === b)));
}

export function isEligible(pr) {
  const labels = (pr.labels ?? []).map((l) => l.name);
  const byDependabot = (pr.author?.login ?? '').toLowerCase().includes('dependabot');
  if (!labels.includes('auto-merge') && !byDependabot) return { ok: false, why: 'not labelled auto-merge and not from Dependabot' };
  if (pr.isDraft) return { ok: false, why: 'draft' };
  if (pr.mergeable === 'CONFLICTING') return { ok: false, why: 'conflicting' };
  const blocked = blockedPaths((pr.files ?? []).map((f) => f.path));
  if (blocked.length > 0) return { ok: false, why: `touches ${blocked.join(', ')} — review only` };
  return { ok: true, why: byDependabot ? 'Dependabot' : 'labelled auto-merge' };
}

const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', env: process.env, maxBuffer: 64 * 1024 * 1024, ...opts });

const log = (msg) => console.log(`[auto-merge] ${msg}`);

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const paused = pauseReason();
  if (paused) return log(`paused (${paused}) — doing nothing.`);

  const listed = sh('gh', ['pr', 'list', '--repo', REPO, '--state', 'open', '--json',
    'number,title,labels,isDraft,mergeable,author,files,headRefName']);
  if (listed.status !== 0) return log(`could not list PRs: ${listed.stderr.trim()}`);

  const prs = JSON.parse(listed.stdout || '[]');
  if (prs.length === 0) return log('no open pull requests.');

  const candidates = prs.map((pr) => ({ pr, verdict: isEligible(pr) }));
  for (const { pr, verdict } of candidates) {
    log(`#${pr.number} ${verdict.ok ? 'eligible' : 'skipped'} — ${verdict.why}: ${pr.title}`);
  }

  // One per run. A queue that merges three things at once turns one bad merge
  // into three, and the deploy check can only speak for the newest.
  const chosen = candidates.find((c) => c.verdict.ok);
  if (!chosen) return log('nothing eligible this run.');

  const { pr } = chosen;
  if (dryRun) return log(`dry run — would gate and merge #${pr.number}.`);

  log(`checking out #${pr.number} and running the gate…`);
  const clean = sh('git', ['status', '--porcelain']);
  if ((clean.stdout || '').trim()) return log('working tree is dirty — refusing to touch it.');

  const before = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  if (sh('gh', ['pr', 'checkout', String(pr.number), '--repo', REPO]).status !== 0) {
    return log(`could not check out #${pr.number}.`);
  }

  const install = sh('npm', ['install', '--no-audit', '--no-fund']);
  const gateRun = install.status === 0 ? sh('node', ['scripts/gate.mjs', '--json']) : null;
  const verdict = gateRun ? JSON.parse(gateRun.stdout || '{"ok":false,"results":[]}') : { ok: false, results: [] };

  sh('git', ['checkout', before || 'main']);
  sh('npm', ['install', '--no-audit', '--no-fund']);

  if (!verdict.ok) {
    const failed = verdict.results.find((r) => !r.ok);
    log(`gate failed on ${failed?.name ?? 'install'} — leaving #${pr.number} open.`);
    sh('gh', ['pr', 'comment', String(pr.number), '--repo', REPO, '--body',
      `Automated gate failed on \`${failed?.name ?? 'npm install'}\`, so this was not merged.\n\n\`\`\`\n${failed?.tail ?? install.stderr?.slice(-800) ?? ''}\n\`\`\``]);
    return;
  }

  log(`gate passed — merging #${pr.number}.`);
  if (sh('gh', ['pr', 'merge', String(pr.number), '--repo', REPO, '--merge', '--delete-branch']).status !== 0) {
    return log(`merge failed for #${pr.number}.`);
  }

  sh('git', ['checkout', 'main']);
  sh('git', ['pull', '--ff-only']);
  log('merged. Waiting for the production deploy before verifying…');

  // The deploy is Vercel's job; give it a bounded wait, then compare what it
  // served against what this build produces.
  await new Promise((r) => setTimeout(r, 90_000));
  sh('npm', ['run', 'build']);
  const live = sh('npm', ['run', 'verify:live']);
  if (live.status === 0) return log(`#${pr.number} merged and production verified.`);

  log('production does not match the build after merging — opening an issue.');
  sh('gh', ['issue', 'create', '--repo', REPO, '--title',
    `Production drift after #${pr.number}`, '--body',
    `\`verify:live\` failed after merging #${pr.number} and waiting for the deploy.\n\n` +
    `This is not automatically reverted: reverting is a judgement call, and the deploy may simply still be in flight.\n\n` +
    `\`\`\`\n${(live.stdout + live.stderr).trim().slice(-1500)}\n\`\`\``]);
}

await main();
