import { hostOf, isHostOrSubdomain } from '../../src/lib/events/url';
import type { EntityInfo, HoldReason } from '../events/check';
import type { CachedPage } from './prefetch';
import type { NewsRef, WorkItem } from './types';

const separator = ' ¶ ';

function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function selectPassages(text: string, hints: string[], maxChars = 6000): string {
  const hintWords = new Set(hints.flatMap(words).filter(word => (word.match(/\p{L}/gu)?.length ?? 0) >= 4));
  const blocks = text.split(separator);
  const ranked = blocks.slice(1).map((block, index) => ({
    index: index + 1,
    score: new Set(words(block).filter(word => hintWords.has(word))).size,
  })).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score);

  const kept = new Set([0]);
  let length = blocks[0].length;
  for (const { index } of ranked) {
    length += separator.length + blocks[index].length;
    if (length > maxChars) break;
    kept.add(index);
  }
  return blocks.filter((_, index) => kept.has(index)).join(separator);
}

export type BatchEntry = {
  id: string;
  url: string;
  entities: Array<{ key: string; name: string; websiteHost: string | null }>;
  refs: NewsRef[];
  page: { finalUrl: string; publishedDates: string[]; sourceDate: string | null; passages: string };
  selfPublishedPrefix: string | null;
};

export function buildBatches(
  items: WorkItem[],
  pages: (id: string) => CachedPage | null,
  entities: Map<string, EntityInfo>,
  size = 20,
): { batches: BatchEntry[][]; holds: Array<{ entities: string[]; sourceUrl: string; reason: HoldReason }> } {
  if (!Number.isInteger(size) || size < 1) throw new Error('size must be a positive integer');
  const batches: BatchEntry[][] = [];
  const holds: Array<{ entities: string[]; sourceUrl: string; reason: HoldReason }> = [];
  let batch: BatchEntry[] | undefined;
  for (const item of items) {
    if (item.cls !== 'fetch') continue;
    const page = pages(item.id);
    if (!page || page.status !== 200) {
      holds.push({ entities: item.entities, sourceUrl: item.url, reason: 'source-unreachable' });
      continue;
    }
    if (page.contentType.split(';', 1)[0].trim().toLowerCase() !== 'text/html') {
      holds.push({ entities: item.entities, sourceUrl: item.url, reason: 'source-not-html' });
      continue;
    }

    const batchEntities = item.entities.map(key => {
      const entity = entities.get(key);
      return { key, name: entity?.name ?? key, websiteHost: entity?.websiteHost ?? null };
    });
    const host = hostOf(page.finalUrl);
    const publisher = batchEntities.find(({ websiteHost }) => websiteHost && isHostOrSubdomain(host, websiteHost));
    const hints = item.refs.flatMap(({ title, excerpt }) => excerpt === null ? [title] : [title, excerpt]);

    if (!batch || batch.length === size) {
      batch = [];
      batches.push(batch);
    }
    batch.push({
      id: item.id,
      url: item.url,
      entities: batchEntities,
      refs: item.refs,
      page: {
        finalUrl: page.finalUrl,
        publishedDates: page.publishedDates,
        // Pages cached before sourceDate existed lack the key.
        sourceDate: page.sourceDate ?? null,
        passages: selectPassages(page.text, hints),
      },
      selfPublishedPrefix: publisher ? `${publisher.name} announced` : null,
    });
  }
  return { batches, holds };
}
