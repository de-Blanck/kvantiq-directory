import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventSchema, type EventRecord } from './schema';
import { buildMatcher } from '../../../scripts/backfill/match';
import type { HeldRecord } from '../../../scripts/events/held';
import { entryTimeline, HIDDEN_LEGACY_REASONS, type LegacyNews } from './timeline';

const KEY = 'companies/iqm';

function event(hex: string, happenedOn: string, entities: string[], url: string): EventRecord {
  return eventSchema.parse({
    schemaVersion: 1, id: `iqm-${happenedOn}-partnership-${hex}`, entities, type: 'partnership', subtype: null, happenedOn, foundOn: '2026-11-01',
    summary: 'IQM will deliver a quantum system',
    source: { url, finalUrl: url, publisher: 'Example' },
    pointers: [], quote: 'IQM will deliver a quantum system in Kajaani.', funding: null, change: null, origin: 'refresh',
    checks: {
      checkerVersion: 1, checkedOn: '2026-11-01', sourceLive: true, sourceCredible: true,
      notPointerOnly: true, quoteFound: true, dateFound: true, amountInQuote: null, typeAgreed: true,
    },
  });
}

function news(slug: string, date = '2026-01-01'): LegacyNews {
  return { title: `Story ${slug}`, url: `https://news.example/${slug}`, source: 'News', date };
}

function held(slug: string, reason: HeldRecord['reason']): HeldRecord {
  return { sourceUrl: `https://news.example/${slug}`, entities: [KEY], reason } as HeldRecord;
}

test('events for the entry only, newest first, ties by id', () => {
  const events = [
    event('bbbbbb', '2026-03-01', [KEY], 'https://e.example/1'),
    event('aaaaaa', '2026-03-01', [KEY], 'https://e.example/2'),
    event('cccccc', '2026-05-01', [KEY], 'https://e.example/3'),
    event('dddddd', '2026-06-01', ['companies/other'], 'https://e.example/4'),
  ];
  const result = entryTimeline(KEY, events, [], buildMatcher(events, [], {}));
  assert.deepEqual(result.events.map(e => e.id), [
    'iqm-2026-05-01-partnership-cccccc',
    'iqm-2026-03-01-partnership-aaaaaa',
    'iqm-2026-03-01-partnership-bbbbbb',
  ]);
});

test('legacy items matched to an event are dropped; held (pointer-only etc.) and unmatched stay, in file order', () => {
  const events = [event('abcdef', '2026-03-01', [KEY], 'https://news.example/matched')];
  const items = [news('pointer'), news('matched'), news('plain'), news('weak')];
  const records = [held('pointer', 'pointer-only'), held('weak', 'source-not-credible')];
  const result = entryTimeline(KEY, events, items, buildMatcher(events, records, {}));
  assert.deepEqual(result.earlierNews.map(n => n.url), [
    'https://news.example/pointer', 'https://news.example/plain', 'https://news.example/weak',
  ]);
});

test('legacy items held as source-unreachable or possible-duplicate are hidden', () => {
  assert.deepEqual([...HIDDEN_LEGACY_REASONS], ['source-unreachable', 'possible-duplicate']);
  const items = [news('dead'), news('dupe'), news('ok')];
  const records = [held('dead', 'source-unreachable'), held('dupe', 'possible-duplicate')];
  const result = entryTimeline(KEY, [], items, buildMatcher([], records, {}));
  assert.deepEqual(result.earlierNews.map(n => n.url), ['https://news.example/ok']);
});

test('an entry whose legacy items are all hidden and has no events gets an empty timeline', () => {
  const deadLink = news('dead');
  const duplicate = news('dupe');
  const records = [held('dead', 'source-unreachable'), held('dupe', 'possible-duplicate')];
  const match = buildMatcher([], records, {});
  assert.deepEqual(entryTimeline(KEY, [], [deadLink, duplicate], match), { events: [], earlierNews: [] });
});
