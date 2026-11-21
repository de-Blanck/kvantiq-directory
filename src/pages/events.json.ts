import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { buildEventsFeed } from '../lib/events/feed';

const collections = ['companies', 'benchmarks', 'use-cases', 'challenges', 'resources'] as const;

export const GET: APIRoute = async () => {
  const [events, ...entries] = await Promise.all([
    getCollection('events'),
    ...collections.map(collection => getCollection(collection)),
  ]);
  const feed = buildEventsFeed(
    events.map(event => event.data),
    entries.flat().map(({ collection, data }) => ({ collection, ...data })),
  );
  return new Response(JSON.stringify(feed), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
