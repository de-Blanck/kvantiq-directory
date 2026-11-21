import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { computeEventId, eventFilePath, eventSchema } from './schema';
import { isHostOrSubdomain, normalizeUrl } from './url';

function valid(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: 'qilimanjaro-2026-11-18-funding-abcdef',
    entities: ['companies/qilimanjaro'],
    type: 'funding',
    subtype: null,
    happenedOn: '2026-11-18',
    foundOn: '2026-11-22',
    summary: 'Qilimanjaro raises €12M in a Series A',
    source: { url: 'https://tech.eu/2026/11/18/qilimanjaro-raises', finalUrl: 'https://tech.eu/2026/11/18/qilimanjaro-raises', publisher: 'tech.eu' },
    pointers: [],
    quote: 'Qilimanjaro has raised €12M in a Series A round.',
    funding: { amount: 12_000_000, currency: 'EUR', round: 'series-a', investors: [] },
    change: null,
    origin: 'refresh',
    checks: {
      checkerVersion: 1, checkedOn: '2026-11-22', sourceLive: true, sourceCredible: true,
      notPointerOnly: true, quoteFound: true, dateFound: true, amountInQuote: true, typeAgreed: true,
    },
    ...overrides,
  };
}

test('url: variants of one story normalise to one URL', () => {
  assert.equal(normalizeUrl('https://www.example.com/news/raise/?utm_source=x&id=7#top'), 'https://example.com/news/raise?id=7');
});
test('url: subdomain helper', () => {
  assert.ok(isHostOrSubdomain('news.qilimanjaro.tech', 'qilimanjaro.tech'));
  assert.ok(!isHostOrSubdomain('notqilimanjaro.tech', 'qilimanjaro.tech'));
});
test('id: formatted and URL-variant-proof', () => {
  const id = computeEventId('companies/iqm', '2026-07-08', 'partnership', 'https://lumi.eu/a?utm_medium=y');
  assert.match(id, /^iqm-2026-07-08-partnership-[0-9a-f]{6}$/);
  assert.equal(id, computeEventId('companies/iqm', '2026-07-08', 'partnership', 'https://www.lumi.eu/a/'));
});
test('schema: a complete funding event parses', () => assert.ok(eventSchema.safeParse(valid()).success));
test('schema: final source URL is required', () => {
  const { finalUrl, ...source } = valid().source;
  assert.equal(eventSchema.safeParse(valid({ source })).success, false);
});
test('schema: final source URL must be HTTP or HTTPS', () => {
  for (const finalUrl of ['not a URL', 'ftp://example.org/story']) {
    assert.equal(eventSchema.safeParse(valid({ source: { ...valid().source, finalUrl } })).success, false);
  }
});
test('schema: a corrected date keeps a valid record (id not recomputed)', () =>
  assert.ok(eventSchema.safeParse(valid({ happenedOn: '2026-11-17' })).success));
test('schema: funding type without funding object fails', () => assert.ok(!eventSchema.safeParse(valid({ funding: null })).success));
test('schema: funding object on a product event fails', () => assert.ok(!eventSchema.safeParse(valid({ type: 'product' })).success));
test('schema: subtype on a non-corporate event fails', () => assert.ok(!eventSchema.safeParse(valid({ subtype: 'merger' })).success));
test('schema: any false check fails', () => assert.ok(!eventSchema.safeParse(valid({ checks: { ...valid().checks, quoteFound: false } })).success));
test('schema: amountInQuote null on a disclosed round fails', () =>
  assert.ok(!eventSchema.safeParse(valid({ checks: { ...valid().checks, amountInQuote: null } })).success));
test('schema: impossible date fails', () => assert.ok(!eventSchema.safeParse(valid({ happenedOn: '2026-02-30' })).success));
test('schema: summary 141 / quote 19 / quote 301 fail', () => {
  for (const o of [{ summary: 'x'.repeat(141) }, { quote: 'x'.repeat(19) }, { quote: 'x'.repeat(301) }])
    assert.ok(!eventSchema.safeParse(valid(o)).success);
});
test('schema: JSON Schema export keeps the type branches', () => {
  const js = z.toJSONSchema(eventSchema) as any;
  assert.ok(Array.isArray(js.oneOf ?? js.anyOf));
});
test('path: year folder from happenedOn', () =>
  assert.equal(eventFilePath({ id: 'a-2026-07-08-other-abcdef', happenedOn: '2026-07-08' }), 'src/content/events/2026/a-2026-07-08-other-abcdef.json'));
