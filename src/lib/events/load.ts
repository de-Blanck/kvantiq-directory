// Server-only glue (astro:content cannot run under node:test). Logic lives in timeline.ts.
import { getCollection } from 'astro:content';
import { buildMatcher, loadAliases } from '../../../scripts/backfill/match';
import { readHeldList } from '../../../scripts/events/run';
import { buildEventsFeed, entityHref, type EventsFeed } from './feed';
import { isPublished } from '../source-bar';
import { toEventRow, type EventRow } from './present';
import { entryTimeline, type LegacyNews } from './timeline';

const collections = ['companies', 'benchmarks', 'use-cases', 'challenges', 'resources'] as const;
const root = process.cwd();

let entriesPromise: ReturnType<typeof loadEntries> | undefined;
let feedPromise: Promise<EventsFeed> | undefined;
let indexPromise: Promise<Record<string, { name: string; href: string | null }>> | undefined;
let matcherPromise: Promise<ReturnType<typeof buildMatcher>> | undefined;

async function loadEntries() {
  const lists = await Promise.all(collections.map(collection => getCollection(collection)));
  return lists.flat().map(({ collection, data }) => ({ collection, ...data }));
}

function entries() {
  entriesPromise ??= loadEntries();
  return entriesPromise;
}

export function loadEventsFeed(): Promise<EventsFeed> {
  feedPromise ??= (async () => {
    const [events, all] = await Promise.all([getCollection('events'), entries()]);
    return buildEventsFeed(events.map(event => event.data), all);
  })();
  return feedPromise;
}

export function loadEntryIndex(): Promise<Record<string, { name: string; href: string | null }>> {
  indexPromise ??= (async () => {
    const all = await entries();
    return Object.fromEntries(all.map(entry => [
      `${entry.collection}/${entry.slug}`,
      {
        name: entry.name,
        // The resources page emits an anchor only for published resources.
        href: entry.collection === 'resources' && !isPublished(entry) ? null : entityHref(entry.collection, entry.slug),
      },
    ]));
  })();
  return indexPromise;
}

function getMatcher(): Promise<ReturnType<typeof buildMatcher>> {
  matcherPromise ??= (async () => {
    const feed = await loadEventsFeed();
    return buildMatcher(feed.events, readHeldList(root), loadAliases(root));
  })();
  return matcherPromise;
}

export async function entryTimelineProps(key: string, news: LegacyNews[]): Promise<{ events: EventRow[]; earlierNews: LegacyNews[] }> {
  const [feed, match] = await Promise.all([loadEventsFeed(), getMatcher()]);
  const timeline = entryTimeline(key, feed.events, news, match);
  return { events: timeline.events.map(event => toEventRow(event, feed.entities)), earlierNews: timeline.earlierNews };
}
