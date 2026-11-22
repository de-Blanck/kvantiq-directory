import { spawnSync } from 'node:child_process';

function firstSeen(root: string, revision: string, options: string[], file: string, url: string): string | null {
  const result = spawnSync('git', [
    '-C', root, 'log', revision, ...options, '--diff-merges=first-parent',
    '--reverse', '--format=%cs', `-S${url}`, '--', file,
  ], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git log failed for ${revision}`);
  }
  return result.stdout.trim().split('\n', 1)[0] || null;
}

export function firstSeenOnMain(root: string, file: string, url: string, mainRef = 'origin/main'): string | null {
  return firstSeen(root, mainRef, ['--first-parent'], file, url);
}

export function firstSeenOnBranch(root: string, base: string, ref: string, file: string, url: string): string | null {
  return firstSeen(root, `${base}..${ref}`, [], file, url);
}
