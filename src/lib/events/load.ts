// Server-only glue (astro:content cannot run under node:test). Logic lives in timeline.ts.
import { getCollection } from 'astro:content';
import { buildMatcher, loadAliases } from '../../../scripts/backfill/match';
import { readHeldList } from '../../../scripts/events/run';
import { buildEventsFeed, entityHref, type EventsFeed } from './feed';
import { toEventRow, type EventRow } from './present';
import { entryTimeline, type LegacyNews } from './timeline';

const collections = ['companies', 'benchmarks', 'use-cases', 'challenges', 'resources'] as const;
const root = process.cwd();

let feedPromise: Promise<EventsFeed> | undefined;
let indexPromise: Promise<Record<string, { name: string; href: string }>> | undefined;
let matcher: ReturnType<typeof buildMatcher> | undefined;

async function loadEntries() {
  const lists = await Promise.all(collections.map(collection => getCollection(collection)));
  return lists.flat().map(({ collection, data }) => ({ collection, ...data }));
}

export function loadEventsFeed(): Promise<EventsFeed> {
  feedPromise ??= (async () => {
    const [events, entries] = await Promise.all([getCollection('events'), loadEntries()]);
    return buildEventsFeed(events.map(event => event.data), entries);
  })();
  return feedPromise;
}

export function loadEntryIndex(): Promise<Record<string, { name: string; href: string }>> {
  indexPromise ??= (async () => {
    const lists = await Promise.all(collections.map(collection => getCollection(collection)));
    return Object.fromEntries(lists.flat().map(({ collection, id, data }) => {
      const slug = id.replace(/\.json$/, '');
      return [`${collection}/${slug}`, { name: data.name, href: entityHref(collection, slug) }];
    }));
  })();
  return indexPromise;
}

async function getMatcher() {
  if (matcher === undefined) {
    const feed = await loadEventsFeed();
    matcher = buildMatcher(feed.events, readHeldList(root), loadAliases(root));
  }
  return matcher;
}

export async function entryTimelineProps(key: string, news: LegacyNews[]): Promise<{ events: EventRow[]; earlierNews: LegacyNews[] }> {
  const [feed, match] = await Promise.all([loadEventsFeed(), getMatcher()]);
  const timeline = entryTimeline(key, feed.events, news, match);
  return { events: timeline.events.map(event => toEventRow(event, feed.entities)), earlierNews: timeline.earlierNews };
}
