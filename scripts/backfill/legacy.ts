import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { topLevelArrays } from '../raw-json';
import { COLLECTIONS, type LegacyItem } from './types';

type LegacyNews = Pick<LegacyItem, 'url' | 'title' | 'source' | 'date'> & { excerpt?: string };

export function scanLegacy(root: string): LegacyItem[] {
  const items: LegacyItem[] = [];
  for (const collection of COLLECTIONS) {
    const directory = join(root, 'src', 'content', collection);
    if (!existsSync(directory)) continue;
    const files = readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => join(entry.parentPath, entry.name))
      .sort();

    for (const path of files) {
      const file = relative(root, path);
      const entity = `${collection}/${basename(path, '.json')}`;
      const raw = readFileSync(path, 'utf8');
      for (const news of topLevelArrays(raw, 'news')) {
        for (const { url, title, excerpt, source, date } of news as LegacyNews[]) {
          items.push({ entity, collection, file, url, title, excerpt: excerpt ?? null, source, date });
        }
      }
    }
  }
  return items;
}
