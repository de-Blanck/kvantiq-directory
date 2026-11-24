import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eventSchema } from '../../src/lib/events/schema';
import { candidateSchema } from './candidate';
import { checkCandidate, type CheckContext, type EntityInfo, type FetchedPage, type HoldReason } from './check';

const source = { url: 'https://tech.eu/2026/11/18/qilimanjaro-raises', publisher: 'tech.eu' };
const quote = 'Qilimanjaro has raised €12M in a Series A round.';
const today = '2026-11-22';

function fixture(name: string) {
  return readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');
}

function candidate(overrides: Record<string, unknown> = {}) {
  return candidateSchema.parse({
    entities: ['companies/qilimanjaro'],
    type: 'funding',
    happenedOn: '2026-11-18',
    summary: 'Qilimanjaro raises €12M in a Series A',
    source,
    quote,
    funding: { amount: 12_000_000, currency: 'EUR', round: 'series-a', investors: [] },
    origin: 'refresh',
    typeSecondOpinion: 'funding',
    ...overrides,
  });
}

function ctx(pageOverrides: Partial<FetchedPage> = {}, extra: Partial<CheckContext> = {}): CheckContext {
  const companies: [string, string, string | null, boolean][] = [
    ['qilimanjaro', 'Qilimanjaro', 'qilimanjaro.tech', true],
    ['iqm', 'IQM', 'meetiqm.com', true],
    ['kvantify', 'Kvantify', 'kvantify.com', true],
    ['ghost', 'Ghost', null, false],
  ];
  const entities = new Map(companies.map(([slug, name, websiteHost, published]): [string, EntityInfo] => {
    const key = `companies/${slug}`;
    return [key, { key, collection: 'companies', name, published, websiteHost, country: null }];
  }));
  return {
    page: { status: 200, contentType: 'text/html', html: fixture('funding-release'), finalUrl: source.url, ...pageOverrides },
    entities, existing: [], today, ...extra,
  };
}

function assertHold(reason: HoldReason, overrides?: Record<string, unknown>, context = ctx()) {
  assert.deepEqual(checkCandidate(candidate(overrides), context), { status: 'hold', reason });
}

const ownPage = ctx({ finalUrl: 'https://qilimanjaro.tech/release', html: fixture('self-release') });
const ownSummary = 'Qilimanjaro announced a €12M Series A';
const existingEvent = {
  id: 'qilimanjaro-2026-11-18-funding-abcdef',
  entities: ['companies/qilimanjaro'],
  type: 'funding' as const,
  happenedOn: '2026-11-18',
  sourceUrls: [source.url],
};

test('unknown-entity', () => assertHold('unknown-entity', { entities: ['companies/unknown'] }));
test('entity-unpublished', () => assertHold('entity-unpublished', { entities: ['companies/ghost'] }));
test('source-unreachable', () => assertHold('source-unreachable', {}, ctx({ status: 403 })));
test('source-not-html', () => assertHold('source-not-html', {}, ctx({ contentType: 'text/plain' })));
test('source-not-credible', () => {
  assertHold('source-not-credible', { source: { ...source, url: 'https://linkedin.com/posts/release' } });
  assertHold('source-not-credible', {}, ctx({ finalUrl: 'https://linkedin.com/posts/release' }));
});
test('self-published-other', () => {
  assertHold('self-published-other', { entities: ['companies/iqm', 'companies/qilimanjaro'] }, ownPage);
});
test('self-published-wording', () => assertHold('self-published-wording', {}, ownPage));
test('pointer-only', () => {
  assertHold('pointer-only', { source: { ...source, url: 'https://quantumcomputingreport.com/release' } });
});
test('quote-not-found', () => assertHold('quote-not-found', { quote: 'This quotation does not appear on the page.' }));
test('date-not-found', () => assertHold('date-not-found', { happenedOn: '2026-12-01' }));
test('date-not-found: an arXiv revision date does not date the result', () => {
  const arxiv = { url: 'https://arxiv.org/abs/2504.01567', publisher: 'arXiv' };
  const html = `<p>Submitted on 2 Apr 2025 (v1), last revised 3 Apr 2025 (this version, v2)</p><p>${quote}</p>`;
  const page = ctx({ html, finalUrl: arxiv.url });
  assertHold('date-not-found', { source: arxiv, happenedOn: '2025-04-03' }, page);
  assert.equal(checkCandidate(candidate({ source: arxiv, happenedOn: '2025-04-02' }), page).status, 'publish');
  const historyOnly = ctx({ html: `<p>[v1] Wed, 2 Apr 2025 [v2] Thu, 3 Apr 2025</p><p>${quote}</p>`, finalUrl: arxiv.url });
  assertHold('date-not-found', { source: arxiv, happenedOn: '2025-04-03' }, historyOnly);
  const noFirstVersion = ctx({ html: `<p>Last revised 3 Apr 2025</p><p>${quote}</p>`, finalUrl: arxiv.url });
  assertHold('date-not-found', { source: arxiv, happenedOn: '2025-04-03' }, noFirstVersion);
});
test('amount-not-in-quote', () => {
  assertHold('amount-not-in-quote', { funding: { ...candidate().funding, amount: 125_000_000 } });
});
test('type-unchecked', () => assertHold('type-unchecked', { typeSecondOpinion: undefined }));
test('type-disagreement', () => assertHold('type-disagreement', { typeSecondOpinion: 'other' }));
test('possible-duplicate', () => {
  assertHold('possible-duplicate', {}, ctx({}, { existing: [{ ...existingEvent, sourceUrls: ['https://example.com/other'] }] }));
});

test('clean candidate publishes a schema-valid record with foundOn = today', () => {
  const verdict = checkCandidate(candidate(), ctx());
  assert.equal(verdict.status, 'publish');
  assert.equal(eventSchema.parse(verdict.record).foundOn, today);
  assert.deepEqual(verdict.sourceUrls, [source.url]);
});
test('own release, worded "<Name> announced", publishes', () => {
  assert.equal(checkCandidate(candidate({ summary: ownSummary }), ownPage).status, 'publish');
});
test('own release worded "Another company announced" holds self-published-wording', () => {
  assertHold('self-published-wording', { summary: 'Another company announced a €12M Series A' }, ownPage);
});
test('subdomain of own site counts as own site', () => {
  const context = ctx({ finalUrl: 'https://news.qilimanjaro.tech/release', html: fixture('self-release') });
  assert.equal(checkCandidate(candidate({ summary: ownSummary }), context).status, 'publish');
  assertHold('self-published-wording', {}, context);
});
test('a third company’s site (not in entities) holds self-published-other', () => {
  assertHold('self-published-other', {}, ctx({ finalUrl: 'https://kvantify.com/release' }));
});
test('clean URL redirecting to a pointer-only host holds pointer-only', () => {
  assertHold('pointer-only', {}, ctx({ finalUrl: 'https://thequantuminsider.com/funding' }));
});
test('200 interstitial holds quote-not-found', () => {
  assertHold('quote-not-found', {}, ctx({ html: fixture('interstitial') }));
});
test('client-rendered page holds quote-not-found', () => {
  assertHold('quote-not-found', {}, ctx({ html: fixture('client-rendered') }));
});
test('status 204 holds source-unreachable; PDF holds source-not-html', () => {
  assertHold('source-unreachable', {}, ctx({ status: 204 }));
  assertHold('source-not-html', {}, ctx({ contentType: 'application/pdf' }));
});
test('re-run of an already published candidate returns already-published', () => {
  assert.deepEqual(checkCandidate(candidate(), ctx({}, { existing: [existingEvent] })), {
    status: 'already-published', id: existingEvent.id,
  });
});
test('URL variant of another entity’s event holds possible-duplicate', () => {
  assertHold('possible-duplicate', { source: { ...source, url: source.url + '/?utm_campaign=news#top' } },
    ctx({}, { existing: [{ ...existingEvent, entities: ['companies/iqm'] }] }));
});
test('backfill foundOn is kept', () => {
  const verdict = checkCandidate(candidate({ origin: 'backfill', foundOn: '2026-11-19' }), ctx());
  assert.equal(verdict.status, 'publish');
  assert.equal(verdict.record.foundOn, '2026-11-19');
});
test('disclosed funding gets amountInQuote true; undisclosed and non-funding get null', () => {
  const cases = [
    [candidate(), true],
    [candidate({ funding: { amount: null, currency: null, round: 'undisclosed', investors: [] } }), null],
    [candidate({ type: 'other', typeSecondOpinion: 'other', funding: null }), null],
  ] as const;
  for (const [input, expected] of cases) {
    const verdict = checkCandidate(input, ctx());
    assert.equal(verdict.status, 'publish');
    assert.equal(verdict.record.checks.amountInQuote, expected);
  }
});

test('publish preserves the submitted URL and stores the post-redirect URL', () => {
  const finalUrl = 'https://tech.eu/news/qilimanjaro-raises';
  const verdict = checkCandidate(candidate(), ctx({ finalUrl }));
  assert.equal(verdict.status, 'publish');
  assert.deepEqual(verdict.record.source, { ...source, finalUrl });
});

test('possible-duplicate: seven days apart counts, eight days apart does not', () => {
  const context = (happenedOn: string) => ctx({}, {
    existing: [{ ...existingEvent, happenedOn, sourceUrls: ['https://example.com/other'] }],
  });
  for (const date of ['2026-11-11', '2026-11-25']) {
    assertHold('possible-duplicate', {}, context(date));
  }
  for (const date of ['2026-11-10', '2026-11-26']) {
    assert.equal(checkCandidate(candidate(), context(date)).status, 'publish');
  }
});
