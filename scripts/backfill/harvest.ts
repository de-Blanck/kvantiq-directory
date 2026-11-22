import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { normalizeUrl } from '../../src/lib/events/url';
import { topLevelArrays } from '../raw-json';
import { firstSeenOnBranch } from './git-dates';
import { scanEntryNews } from './legacy';
import { COLLECTIONS, type Collection, type Harvest, type HarvestChange, type HarvestSource } from './types';

const trackedFields: Record<Collection, string[]> = {
  companies: ['funding', 'employees', 'headquarters', 'products', 'accessModel'],
  resources: ['lastUpdated', 'maturity'],
  benchmarks: [],
  challenges: ['registrationDeadline', 'prizes'],
  'use-cases': [],
};

type EntrySource = HarvestSource['source'];

function git(root: string, ...args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
}

export function discoverRefs(root: string): string[] {
  return git(root, 'for-each-ref', '--format=%(refname:short)',
    'refs/remotes/origin/chore/auto-refresh-*', 'refs/remotes/origin/ai-sweep/*')
    .trim().split('\n').filter(Boolean);
}

function keepEarliest<T extends { entity: string; refs: string[]; foundOn: string }>(
  items: Map<string, T>, url: string, item: T,
): void {
  const key = `${item.entity}|${normalizeUrl(url)}`;
  const previous = items.get(key);
  if (!previous) {
    items.set(key, item);
    return;
  }
  const refs = [...new Set([...previous.refs, ...item.refs])];
  items.set(key, { ...(item.foundOn < previous.foundOn ? item : previous), refs });
}

export function harvest(root: string, refs: string[], mainRef = 'origin/main'): Harvest {
  const snapshots: Harvest['refs'] = [];
  const news = new Map<string, Harvest['news'][number]>();
  const sources = new Map<string, HarvestSource & { foundOn: string }>();
  const changes = new Map<string, HarvestChange[]>();

  for (const ref of new Set(refs)) {
    const head = git(root, 'rev-parse', '--verify', `${ref}^{commit}`).trim();
    const base = git(root, 'merge-base', mainRef, head).trim();
    const headDate = git(root, 'show', '-s', '--format=%cs', head).trim();
    const otherPaths: string[] = [];
    snapshots.push({ ref, head, base, headDate, otherPaths });

    const paths = git(root, 'diff', '--name-status', '--no-renames', '-z', base, head).split('\0');
    for (let index = 0; index + 1 < paths.length; index += 2) {
      const [status, file] = [paths[index], paths[index + 1]];
      if (!file.startsWith('src/content/') || !file.endsWith('.json')) {
        otherPaths.push(file);
        continue;
      }
      const collection = COLLECTIONS.find(name => file.startsWith(`src/content/${name}/`));
      if (!collection) continue;

      const entity = `${collection}/${basename(file, '.json')}`;
      const before = status === 'A' ? '{}' : git(root, 'show', `${base}:${file}`);
      const after = status === 'D' ? '{}' : git(root, 'show', `${head}:${file}`);
      const firstSeen = (url: string) => firstSeenOnBranch(root, base, head, file, url) ?? headDate;

      const baseNews = new Set(scanEntryNews(before, collection, file).map(item => normalizeUrl(item.url)));
      for (const item of scanEntryNews(after, collection, file)) {
        if (!baseNews.has(normalizeUrl(item.url))) {
          keepEarliest(news, item.url, { ...item, refs: [ref], foundOn: firstSeen(item.url) });
        }
      }

      const baseSources = topLevelArrays(before, 'sources').flat() as EntrySource[];
      const branchSources = topLevelArrays(after, 'sources').flat() as EntrySource[];
      const baseUrls = new Set(baseSources.map(source => source.url));
      for (const source of branchSources) {
        const { url } = source;
        if (baseUrls.has(url)) continue;
        const foundOn = firstSeen(url);
        keepEarliest(sources, url, {
          entity,
          source,
          refs: [ref],
          foundOn,
        });
      }

      const baseEntry = JSON.parse(before);
      const branchEntry = JSON.parse(after);
      for (const field of trackedFields[collection]) {
        const from = baseEntry[field] ?? null;
        const to = branchEntry[field] ?? null;
        if (JSON.stringify(from) === JSON.stringify(to)) continue;
        const key = `${entity}|${field}`;
        const change = { entity, field, from, to, ref, headDate, superseded: [] };
        const versions = changes.get(key);
        if (versions) versions.push(change);
        else changes.set(key, [change]);
      }
    }
  }

  return {
    refs: snapshots,
    news: [...news.values()],
    sources: [...sources.values()].map(({ entity, source, refs }) => ({ entity, source, refs })),
    changes: [...changes.values()].map(versions => {
      const [winner, ...older] = versions.sort((a, b) => b.headDate.localeCompare(a.headDate));
      return { ...winner, superseded: older.map(({ ref, to }) => ({ ref, to })) };
    }),
  };
}
