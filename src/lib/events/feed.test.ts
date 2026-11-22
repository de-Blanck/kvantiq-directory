import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEventsFeed, entityHref, eventsFeedJsonSchema, type FeedEntryInput } from './feed';
import { eventSchema } from './schema';

const sources = [
  { url: 'https://reuters.com/story' },
  { url: 'https://tech.eu/story' },
  { url: 'https://hpcwire.com/story' },
];
const entries: FeedEntryInput[] = [
  { collection: 'companies', slug: 'iqm', name: 'IQM', country: 'Finland', sources },
  { collection: 'companies', slug: 'ghost', name: 'Ghost', sources: sources.slice(0, 1) },
  { collection: 'resources', slug: 'qiskit', name: 'Qiskit', sources },
];

function event(overrides: Record<string, unknown> = {}) {
  return eventSchema.parse({
    schemaVersion: 1,
    id: 'iqm-2026-07-08-partnership-abcdef',
    entities: ['companies/iqm'],
    type: 'partnership',
    subtype: null,
    happenedOn: '2026-07-08',
    foundOn: '2026-07-12',
    summary: 'IQM will deliver a quantum system',
    source: { url: 'https://example.org/story', finalUrl: 'https://example.org/story', publisher: 'Example' },
    pointers: [],
    quote: 'IQM will deliver a quantum system in Kajaani.',
    funding: null,
    change: null,
    origin: 'refresh',
    checks: {
      checkerVersion: 1, checkedOn: '2026-07-12', sourceLive: true, sourceCredible: true,
      notPointerOnly: true, quoteFound: true, dateFound: true, amountInQuote: null, typeAgreed: true,
    },
    ...overrides,
  });
}

test('feed: event with an unpublished primary entity is excluded', () => {
  assert.deepEqual(buildEventsFeed([event({ entities: ['companies/ghost'] })], entries),
    { schemaVersion: 1, count: 0, entities: {}, events: [] });
});
test('feed: event with an unpublished or missing secondary entity is excluded', () => {
  const events = ['companies/ghost', 'companies/missing']
    .map(secondary => event({ entities: ['companies/iqm', secondary] }));
  assert.equal(buildEventsFeed(events, entries).count, 0);
});
test('feed: newest first, ties by id', () => {
  const earlier = event();
  const newestFirst = event({ happenedOn: '2026-07-09', id: 'iqm-2026-07-09-partnership-000000' });
  const newestSecond = event({ happenedOn: '2026-07-09', id: 'iqm-2026-07-09-partnership-111111' });
  assert.deepEqual(buildEventsFeed([earlier, newestSecond, newestFirst], entries).events,
    [newestFirst, newestSecond, earlier]);
});
test('feed: entities map has only published, referenced keys', () => {
  const feed = buildEventsFeed([event(), event({ entities: ['companies/ghost', 'resources/qiskit'] })], entries);
  assert.deepEqual(feed.entities, {
    'companies/iqm': { name: 'IQM', country: 'Finland', href: '/companies/iqm/' },
  });
});
test('feed: hrefs per collection; resources go to /resources/', () => {
  for (const collection of ['companies', 'benchmarks', 'use-cases', 'challenges']) {
    assert.equal(entityHref(collection, 'example'), `/${collection}/example/`);
  }
  assert.equal(entityHref('resources', 'qiskit'), '/resources/');
});
test('schema: envelope schema references the EventRecord definition', () => {
  const s = eventsFeedJsonSchema() as any;
  assert.equal(s.properties.events.items.$ref, '#/$defs/EventRecord');
  assert.ok(s.$defs.EventRecord);
  for (const [, ref] of JSON.stringify(s).matchAll(/"\$ref":"(#\/[^"]+)"/g)) {
    const target = ref.slice(2).split('/').reduce((node, key) => node?.[key], s);
    assert.ok(target, ref);
  }
});
