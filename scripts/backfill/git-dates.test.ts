import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { firstSeenOnBranch, firstSeenOnMain } from './git-dates';

test('first-seen dates use the main merge date and the branch commit date', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'backfill-git-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  function git(args: string[], committerDate = '2026-01-01', authorDate = committerDate): string {
    return execFileSync('git', [
      '-C', root, '-c', 'user.name=Test', '-c', 'user.email=test@example.com',
      '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', ...args,
    ], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_COMMITTER_DATE: `${committerDate}T12:00:00Z`,
        GIT_AUTHOR_DATE: `${authorDate}T12:00:00Z`,
      },
    }).trim();
  }

  const file = 'a.json';
  const url = 'https://example.com/news';
  git(['init', '--initial-branch=main']);
  writeFileSync(join(root, file), '{"news":[]}\n');
  git(['add', '--', file]);
  git(['commit', '-m', 'Base']);
  const base = git(['rev-parse', 'HEAD']);
  git(['checkout', '-b', 'f']);
  writeFileSync(join(root, file), JSON.stringify({ news: [{ url }] }) + '\n');
  git(['commit', '-am', 'Add URL'], '2026-02-01');
  git(['checkout', 'main']);
  git(['merge', '--no-ff', '--no-edit', 'f'], '2026-03-01', '2026-02-28');

  assert.equal(firstSeenOnMain(root, file, url, 'main'), '2026-03-01');
  assert.equal(firstSeenOnBranch(root, base, 'f', file, url), '2026-02-01');
  const absent = 'https://example.com/absent';
  assert.equal(firstSeenOnMain(root, file, absent, 'main'), null);
  assert.equal(firstSeenOnBranch(root, base, 'f', file, absent), null);
});
