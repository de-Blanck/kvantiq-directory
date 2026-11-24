import assert from 'node:assert/strict';
import test from 'node:test';
import type { EntityInfo } from '../events/check';
import { buildBatches, selectPassages } from './batches';
import type { CachedPage } from './prefetch';
import { hash12, type WorkItem } from './types';

const key = 'companies/qilimanjaro';
const entity: EntityInfo = {
  key, name: 'Qilimanjaro', collection: 'companies', websiteHost: 'qilimanjaro.tech',
  published: true, country: null,
};
const entities = new Map([[key, entity]]);
const date = '2026-11-22';

function item(index = 0): WorkItem {
  const url = `https://example.com/news/${index}`;
  return {
    id: hash12(url), url, resolvedFrom: [], entities: [key], collections: ['companies'],
    cls: 'fetch', happenedOnHint: date, foundOn: date,
    refs: [{ entity: key, url, title: 'Qilimanjaro raises', excerpt: 'Quantum funding', source: 'Example', date, origin: 'legacy', refs: [] }],
  };
}

function page({ id, url }: WorkItem): CachedPage {
  return {
    id, url, fetchedOn: date, status: 200, contentType: 'text/html; charset=utf-8',
    finalUrl: 'https://news.qilimanjaro.tech/x', publishedDates: [date], sourceDate: null,
    text: 'Intro ¶ menu ¶ Quantum funding announced', error: null,
  };
}

test('selectPassages keeps the first block and prioritises blocks matching the hints', () => {
  assert.equal(
    selectPassages('Intro ¶ menu ¶ IQM raises EUR 300M ¶ footer', ['IQM raises 300M'], 40),
    'Intro ¶ IQM raises EUR 300M',
  );
  assert.equal(
    selectPassages('Intro ¶ Funding ¶ Quantum funding ¶ Quantum', ['funding FUNDING Quantum'], 33),
    'Intro ¶ Funding ¶ Quantum funding',
  );
});

test('buildBatches holds missing, unreachable, and non-HTML pages', () => {
  const items = [item(0), item(1), item(2)];
  const pages = new Map([
    [items[1].id, { ...page(items[1]), status: 403 }],
    [items[2].id, { ...page(items[2]), contentType: 'application/pdf' }],
  ]);
  assert.deepEqual(buildBatches(items, id => pages.get(id) ?? null, entities), {
    batches: [],
    holds: items.map(({ entities, url }, index) => ({
      entities, sourceUrl: url, reason: index === 2 ? 'source-not-html' : 'source-unreachable',
    })),
  });
});

test('buildBatches uses the final URL to identify self-published pages and uses refs as hints', () => {
  const target = item();
  const cached = page(target);
  assert.deepEqual(buildBatches([target], () => cached, entities), {
    batches: [[{
      id: target.id, url: target.url, refs: target.refs,
      entities: [{ key, name: 'Qilimanjaro', websiteHost: 'qilimanjaro.tech' }],
      page: { finalUrl: cached.finalUrl, publishedDates: [date], sourceDate: null, passages: 'Intro ¶ Quantum funding announced' },
      selfPublishedPrefix: 'Qilimanjaro announced',
    }]],
    holds: [],
  });
});

test('buildBatches passes sourceDate through and treats a page cached without one as null', () => {
  const target = item();
  const dated = { ...page(target), sourceDate: '2026-08-13' };
  assert.equal(buildBatches([target], () => dated, entities).batches[0][0].page.sourceDate, '2026-08-13');
  const { sourceDate: _, ...legacy } = page(target);
  assert.equal(buildBatches([target], () => legacy as CachedPage, entities).batches[0][0].page.sourceDate, null);
});

test('buildBatches groups 45 entries into batches of 20, 20 and 5 in input order', () => {
  const items = Array.from({ length: 45 }, (_, index) => item(index));
  const pages = new Map(items.map(target => [target.id, page(target)]));
  const { batches, holds } = buildBatches(items, id => pages.get(id) ?? null, entities);
  assert.deepEqual(batches.map(batch => batch.length), [20, 20, 5]);
  assert.deepEqual(batches.flat().map(entry => entry.id), items.map(target => target.id));
  assert.deepEqual(holds, []);
});
