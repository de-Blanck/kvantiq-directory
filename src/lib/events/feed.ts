import { z } from 'zod';
import { isPublished } from '../source-bar';
import { eventSchema, RUNTIME_ONLY_RULES, type EventRecord } from './schema';

export type FeedEntity = { name: string; country: string | null; href: string };
export type EventsFeed = { schemaVersion: 1; count: number; entities: Record<string, FeedEntity>; events: EventRecord[] };
export type FeedEntryInput = { collection: string; slug: string; name: string; country?: string; sources?: { url: string; title?: string }[] };

export function entityHref(collection: string, slug: string): string {
  return collection === 'resources' ? '/resources/' : `/${collection}/${slug}/`;
}

export function buildEventsFeed(events: EventRecord[], entries: FeedEntryInput[]): EventsFeed {
  const published = new Map<string, FeedEntity>();
  for (const entry of entries.filter(isPublished)) {
    const { collection, slug, name, country } = entry;
    published.set(`${collection}/${slug}`, { name, country: country ?? null, href: entityHref(collection, slug) });
  }

  const kept = events.filter(event => event.entities.every(key => published.has(key)))
    .sort((a, b) => b.happenedOn.localeCompare(a.happenedOn) || a.id.localeCompare(b.id));
  const keys = new Set(kept.flatMap(event => event.entities));
  const entities = Object.fromEntries([...keys].sort().map(key => [key, published.get(key)!]));
  return { schemaVersion: 1, count: kept.length, entities, events: kept };
}

export function eventsFeedJsonSchema(): object {
  const { $schema, ...record } = z.toJSONSchema(eventSchema);
  // References generated for recursive JSON values now live inside the EventRecord definition.
  const nestedRecord = JSON.parse(JSON.stringify(record, (key, value) =>
    key === '$ref' && typeof value === 'string' && value.startsWith('#/')
      ? value.replace('#/', '#/$defs/EventRecord/')
      : value));

  return {
    $schema,
    $id: 'https://directory.kvantiq.studio/event.schema.json',
    description: RUNTIME_ONLY_RULES.join(' '),
    type: 'object',
    required: ['schemaVersion', 'count', 'entities', 'events'],
    additionalProperties: false,
    properties: {
      schemaVersion: { const: 1 },
      count: { type: 'integer', minimum: 0 },
      entities: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          required: ['name', 'country', 'href'],
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            country: { type: ['string', 'null'] },
            href: { type: 'string' },
          },
        },
      },
      events: { type: 'array', items: { $ref: '#/$defs/EventRecord' } },
    },
    $defs: { EventRecord: nestedRecord },
  };
}
