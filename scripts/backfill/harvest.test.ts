import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { discoverRefs, harvest } from './harvest';

test('harvest reports added citations and the latest scalar changes from exact heads', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'backfill-harvest-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  function git(args: string[], date = '2026-01-01'): string {
    return execFileSync('git', [
      '-C', root, '-c', 'user.name=Test', '-c', 'user.email=test@example.com',
      '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', ...args,
    ], {
      encoding: 'utf8',
      env: { ...process.env, GIT_AUTHOR_DATE: date + 'T12:00:00Z', GIT_COMMITTER_DATE: date + 'T12:00:00Z' },
    }).trim();
  }
  function write(file: string, value: unknown): void {
    writeFileSync(join(root, file), JSON.stringify(value));
  }
  const a = 'src/content/companies/a.json';
  const b = 'src/content/companies/b.json';
  const old = { url: 'https://example.com/old', title: 'Old', source: 'Example', date: '2026-01-01' };
  const added = { ...old, url: 'https://x.com/n1', title: 'New' };
  const source = { type: 'url', url: 'https://example.com/new', title: 'Source', dateAccessed: '2026-02-01' };
  const base = { news: [old], funding: 'EUR 12M', employees: 20 };
  const older = 'chore/auto-refresh-1';
  const newer = 'chore/auto-refresh-2';
  git(['init', '--initial-branch=main']);
  mkdirSync(join(root, 'src/content/companies'), { recursive: true });
  write(a, base);
  git(['add', '.']);
  git(['commit', '-m', 'Base']);
  git(['checkout', '-b', older]);
  const earlierNews = { ...added, url: added.url + '?utm_source=refresh' };
  const earlierSource = { type: 'arxiv', url: source.url + '?utm_source=refresh', title: source.title };
  write(a, { ...base, funding: 'EUR 13M', news: [old, earlierNews], sources: [earlierSource] });
  git(['commit', '-am', 'Older refresh'], '2026-02-01');
  git(['checkout', '-b', newer, 'main']);
  writeFileSync(join(root, a), `{"news":[${JSON.stringify({ ...old, url: old.url + '?utm_source=refresh' })}],"news":[${JSON.stringify(added)}],"sources":[${JSON.stringify(source)}],"funding":"EUR 15M"}`);
  write(b, { news: [added] });
  git(['add', '.']);
  git(['commit', '-m', 'New citations'], '2026-03-01');
  write('package-lock.json', {});
  git(['add', 'package-lock.json']);
  git(['commit', '-m', 'Other change'], '2026-04-01');
  git(['update-ref', 'refs/remotes/origin/' + newer, newer]);
  git(['update-ref', 'refs/remotes/origin/ai-sweep/test', older]);
  git(['update-ref', 'refs/remotes/origin/unrelated', older]);

  assert.deepEqual(discoverRefs(root), ['origin/ai-sweep/test', 'origin/' + newer]);
  const result = harvest(root, [newer, older], 'main');
  assert.deepEqual(result.news.map(({ entity, url, foundOn, refs }) => ({ entity, url, foundOn, refs })), [
    { entity: 'companies/a', url: earlierNews.url, foundOn: '2026-02-01', refs: [newer, older] },
    { entity: 'companies/b', url: added.url, foundOn: '2026-03-01', refs: [newer] },
  ]);
  assert.deepEqual(result.sources, [{
    entity: 'companies/a',
    source: { ...source, url: earlierSource.url },
    refs: [newer, older],
  }]);
  assert.deepEqual(result.changes.find(change => change.field === 'funding'), {
    entity: 'companies/a', field: 'funding', from: 'EUR 12M', to: 'EUR 15M',
    ref: newer, headDate: '2026-04-01', superseded: [{ ref: older, to: 'EUR 13M' }],
  });
  assert.equal(result.changes.find(change => change.field === 'employees')?.to, null);
  assert.deepEqual(result.refs[0].otherPaths, ['package-lock.json']);
  assert.equal(result.refs[0].head, git(['rev-parse', newer]));

  git(['update-ref', 'refs/remotes/origin/main', 'main']);
  execFileSync(process.execPath, [
    '--import', import.meta.resolve('tsx'), fileURLToPath(new URL('./cli.ts', import.meta.url)), 'harvest',
  ], { cwd: root });
  assert.deepEqual(JSON.parse(readFileSync(join(root, '.backfill/harvest.json'), 'utf8')),
    harvest(root, discoverRefs(root)));
});
