import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isBlocklistedSource } from '../../src/lib/credibility.mjs';
import { isCredibleSource } from '../../src/lib/source-bar';
import { appendToTopLevelArray, topLevelArrays } from '../raw-json';
import type { FetchedPage } from '../events/check';
import type { Collection, HarvestSource } from './types';

export async function applySources(
  root: string,
  sources: HarvestSource[],
  collection: Collection,
  fetchPage: (url: string) => Promise<FetchedPage>,
): Promise<{ applied: number; dropped: Array<{ entity: string; url: string; reason: string }> }> {
  const byEntity = new Map<string, HarvestSource['source'][]>();
  for (const { entity, source } of sources) {
    if (!entity.startsWith(collection + '/')) continue;
    const group = byEntity.get(entity);
    if (group) group.push(source);
    else byEntity.set(entity, [source]);
  }

  let applied = 0;
  const dropped: Array<{ entity: string; url: string; reason: string }> = [];
  for (const [entity, incoming] of byEntity) {
    const path = join(root, 'src/content', entity + '.json');
    const raw = readFileSync(path, 'utf8');
    const existing = topLevelArrays(raw, 'sources').flat() as Array<{ url: string }>;
    const urls = new Set(existing.map(source => source.url));
    const kept: HarvestSource['source'][] = [];

    for (const source of incoming) {
      const { url } = source;
      let reason: string;
      if (isBlocklistedSource(source)) {
        reason = 'blocklisted';
      } else if (!isCredibleSource(source)) {
        reason = 'not-credible';
      } else if (urls.has(url)) {
        reason = 'duplicate';
      } else {
        const { status } = await fetchPage(url);
        if (status === 200) {
          kept.push(source);
          urls.add(url);
          continue;
        }
        reason = `status ${status}`;
      }
      dropped.push({ entity, url, reason });
    }

    if (kept.length > 0) {
      const tmp = path + '.tmp';
      writeFileSync(tmp, appendToTopLevelArray(raw, 'sources', kept));
      renameSync(tmp, path);
      applied += kept.length;
    }
  }
  return { applied, dropped };
}
