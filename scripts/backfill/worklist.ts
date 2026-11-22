import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isBlocklistedSource } from '../../src/lib/credibility.mjs';
import { POINTER_ONLY_DOMAINS } from '../../src/lib/events/pointer-domains';
import type { EventRecord } from '../../src/lib/events/schema';
import { hostOf, isHostOrSubdomain, normalizeUrl } from '../../src/lib/events/url';
import { firstSeenOnMain } from './git-dates';
import { ALIASES_PATH, eventUrls, loadAliases, type buildMatcher } from './match';
import { COLLECTIONS, hash12, type Collection, type Harvest, type LegacyItem, type NewsRef, type WorkClass, type WorkItem } from './types';

function classify(url: string): WorkClass {
  const host = hostOf(url);
  if (POINTER_ONLY_DOMAINS.some(domain => isHostOrSubdomain(host, domain))) return 'pointer-only';
  if (isBlocklistedSource({ url })) return 'blocklisted';
  const { pathname, search } = new URL(url);
  return (pathname === '' || pathname === '/') && search === '' ? 'homepage' : 'fetch';
}

export function buildWorklist(
  root: string,
  legacy: LegacyItem[],
  harvest: Harvest | null,
  resolved: Array<{ hid: string; url: string | null }>,
): WorkItem[] {
  const resolutions = new Map(resolved.map(({ hid, url }) => [hid, url]));
  const groups = new Map<string, Array<{
    ref: NewsRef; collection: Collection; effectiveUrl: string; foundOn: string | null;
  }>>();

  function add(item: LegacyItem, origin: NewsRef['origin'], refs: string[], foundOn: string | null): void {
    const { entity, url, title, excerpt, source, date, collection } = item;
    const effectiveUrl = resolutions.get(hash12(url)) ?? url;
    const key = normalizeUrl(effectiveUrl);
    const entry = { ref: { entity, url, title, excerpt, source, date, origin, refs }, collection, effectiveUrl, foundOn };
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }

  for (const item of legacy) add(item, 'legacy', [], firstSeenOnMain(root, item.file, item.url));
  for (const item of harvest?.news ?? []) add(item, 'harvest', item.refs, item.foundOn);

  return [...groups.values()].map(group => {
    const url = group[0].effectiveUrl;
    const refs = group.map(entry => entry.ref);
    const resolvedFrom = [...new Set(group
      .filter(entry => entry.ref.url !== entry.effectiveUrl)
      .map(entry => entry.ref.url))];
    const collections = COLLECTIONS.filter(collection => group.some(entry => entry.collection === collection));
    const entities = collections.flatMap(collection =>
      [...new Set(group.filter(entry => entry.collection === collection).map(entry => entry.ref.entity))].sort());
    const happenedOnHint = refs.map(ref => ref.date).sort()[0];
    const earliest = group.map(entry => entry.foundOn ?? happenedOnHint).sort()[0];
    const foundOn = earliest < happenedOnHint ? happenedOnHint : earliest;
    let cls = classify(url);
    const dates = refs.map(ref => Date.parse(ref.date));
    if (cls === 'fetch' && Math.max(...dates) - Math.min(...dates) > 7 * 86400000) cls = 'listing';
    return { id: hash12(url), url, resolvedFrom, entities, collections, cls, refs, happenedOnHint, foundOn };
  });
}

export function pendingItems(
  items: WorkItem[], collection: Collection, match: ReturnType<typeof buildMatcher>, events: EventRecord[],
): { pending: WorkItem[]; partial: Array<{ entities: string[]; sourceUrl: string; reason: 'possible-duplicate' }> } {
  const publishedUrls = new Set(events.flatMap(eventUrls));
  const pending: WorkItem[] = [];
  const partial: Array<{ entities: string[]; sourceUrl: string; reason: 'possible-duplicate' }> = [];
  for (const item of items) {
    if (!item.collections.includes(collection)) continue;
    const unmatched = new Set(item.refs.filter(ref => match(ref.entity, ref.url) === null).map(ref => ref.entity));
    if (unmatched.size === 0) continue;
    if (publishedUrls.has(normalizeUrl(item.url))) {
      partial.push({
        entities: item.entities.filter(entity => unmatched.has(entity)),
        sourceUrl: item.url,
        reason: 'possible-duplicate',
      });
    } else {
      pending.push(item);
    }
  }
  return { pending, partial };
}

export function recordAliases(root: string, items: WorkItem[]): number {
  const aliases = loadAliases(root);
  const previousCount = Object.keys(aliases).length;
  for (const item of items) {
    const resolved = normalizeUrl(item.url);
    for (const ref of item.refs) {
      const original = normalizeUrl(ref.url);
      if (original !== resolved) aliases[`${ref.entity}|${original}`] = resolved;
      else delete aliases[`${ref.entity}|${original}`];
    }
  }
  const keys = Object.keys(aliases).sort();
  const sorted = Object.fromEntries(keys.map(key => [key, aliases[key]]));
  const path = join(root, ALIASES_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path + '.tmp', JSON.stringify(sorted, null, 2) + '\n');
  renameSync(path + '.tmp', path);
  return keys.length - previousCount;
}
