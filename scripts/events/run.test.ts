import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { computeEventId } from '../../src/lib/events/schema';
import { heldKey, isoWeek, mergeHeld, type HeldRecord } from './held';
import { loadExistingEvents, readHeldList, runCheck, writeHeldList, type RunOptions } from './run';

const today = '2026-11-22';
const url = 'https://tech.eu/2026/11/18/qilimanjaro-raises';
const redirected = 'https://tech.eu/news/raise/';
const primary = 'companies/qilimanjaro';
const html = readFileSync(new URL('./fixtures/funding-release.html', import.meta.url), 'utf8');
const id = computeEventId(primary, '2026-11-18', 'funding', url);
const empty = { published: [], alreadyPublished: [], held: {}, invalid: [], stale: 0, skippedStale: 0 };

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    entities: [primary], type: 'funding', happenedOn: '2026-11-18',
    summary: 'Qilimanjaro raises €12M in a Series A',
    source: { url, publisher: 'tech.eu' },
    quote: 'Qilimanjaro has raised €12M in a Series A round.',
    funding: { amount: 12_000_000, currency: 'EUR', round: 'series-a', investors: [] },
    origin: 'refresh', typeSecondOpinion: 'funding', ...overrides,
  };
}

const heldInput = { entities: [primary], sourceUrl: url, reason: 'quote-not-found' as const };
function setup(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'events-check-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'src/content/companies'), { recursive: true });
  mkdirSync(join(root, 'data'));
  const sources = ['https://tech.eu/a', 'https://www.reuters.com/a', 'https://sifted.eu/a'].map(url => ({ url }));
  for (const [slug, name, count] of [['qilimanjaro', 'Qilimanjaro', 3], ['ghost', 'Ghost', 1]] as const) {
    writeFileSync(join(root, 'src/content/companies', slug + '.json'), JSON.stringify({
      name, website: 'https://' + slug + '.example', sources: sources.slice(0, count),
    }));
  }
  const heldPath = join(root, 'data/events-held.json');
  const eventPath = join(root, 'src/content/events/2026', id + '.json');
  const writeHeld = (records: HeldRecord[]) => writeFileSync(heldPath, JSON.stringify(records));
  writeHeld([]);
  const run = (overrides: Partial<RunOptions> = {}) => runCheck({
    root, input: [candidate()], today, dryRun: false,
    fetchPage: async () => ({ status: 200, contentType: 'text/html', html, finalUrl: redirected }),
    ...overrides,
  });
  return { root, heldPath, eventPath, writeHeld, run };
}

test('publishes a clean candidate and writes its file', async t => {
  const { root, run, eventPath, heldPath } = setup(t);
  assert.deepEqual(await run(), { ...empty, published: [id] });
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  assert.deepEqual(event.source, { ...candidate().source, finalUrl: redirected });
  assert.deepEqual(loadExistingEvents(root), [{
    id, entities: [primary], type: 'funding', happenedOn: '2026-11-18',
    sourceUrls: [url, 'https://tech.eu/news/raise'],
  }]);
  assert.equal(readFileSync(heldPath, 'utf8'), '[]\n');
  assert.ok(!existsSync(heldPath + '.tmp'));
});

test('two candidates with the same URL in one batch: one published, one possible-duplicate', async t => {
  const { run, root } = setup(t);
  const other = join(root, 'src/content/companies/other.json');
  writeFileSync(other, readFileSync(join(root, 'src/content/companies/qilimanjaro.json')));
  assert.deepEqual(await run({ input: [candidate(), candidate({ entities: ['companies/other'] })] }), {
    ...empty, published: [id], held: { 'possible-duplicate': 1 },
  });
  assert.equal(loadExistingEvents(root).length, 1);
});

test('malformed items go to invalid, valid ones still run', async t => {
  const { run, eventPath } = setup(t);
  const summary = await run({ input: [null, {}, candidate()] });
  assert.deepEqual(summary, { ...empty, published: [id], invalid: summary.invalid });
  assert.deepEqual(summary.invalid.map(item => item.index), [0, 1]);
  for (const item of summary.invalid) assert.ok(item.error.length > 0);
  assert.ok(existsSync(eventPath));
});

test('non-array input throws', async t => {
  await assert.rejects(setup(t).run({ input: {} }), /array/);
});

test('held record carries no summary or quote', async t => {
  const { run, heldPath } = setup(t);
  assert.deepEqual(await run({ input: [candidate({ entities: ['companies/ghost'] })] }), {
    ...empty, held: { 'entity-unpublished': 1 },
  });
  const raw = readFileSync(heldPath, 'utf8');
  assert.deepEqual(JSON.parse(raw), [{
    key: heldKey(['companies/ghost'], url), entities: ['companies/ghost'], sourceUrl: url,
    reason: 'entity-unpublished', firstHeldOn: today, lastCheckedOn: today, attempts: 1, stale: false,
  }]);
  assert.ok(!raw.includes(candidate().quote));
});

test('mergeHeld: an unresubmitted key ages once per ISO week and goes stale in week 8', () => {
  const dates = ['2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07',
    '2026-12-14', '2026-12-21', '2026-12-28', '2027-01-04'];
  assert.equal(isoWeek('2027-01-01'), '2026-W53');
  let records = mergeHeld([], [heldInput], new Set(), dates[0]);
  assert.deepEqual(mergeHeld(records, [], new Set(), today), records);
  for (const [index, date] of dates.entries()) {
    records = mergeHeld(records, [], new Set(), date);
    assert.equal(records[0].attempts, index + 1);
    assert.equal(records[0].lastCheckedOn, date);
    assert.equal(records[0].stale, index === 7);
  }
  assert.deepEqual(mergeHeld(records, [], new Set(), '2027-01-11'), records);
});

test('mergeHeld: three variants of one key in one run cost one attempt', () => {
  const variants = [heldInput, { ...heldInput, sourceUrl: url + '/#top' },
    { ...heldInput, sourceUrl: url + '?utm_source=x' }];
  const records = mergeHeld([], variants, new Set(), today);
  assert.equal(records.length, 1);
  assert.equal(records[0].attempts, 1);
  const next = mergeHeld(records, variants, new Set(), '2026-11-23');
  assert.equal(next.length, 1);
  assert.equal(next[0].attempts, 2);
});

test('mergeHeld: firstHeldOn never changes; resolved keys are removed', () => {
  const records = mergeHeld([], [heldInput], new Set(), today);
  const changed = { ...heldInput, reason: 'date-not-found' } as const;
  const updated = mergeHeld(records, [changed], new Set(), '2026-11-23');
  assert.deepEqual(updated, [{ ...records[0], reason: changed.reason, lastCheckedOn: '2026-11-23', attempts: 2 }]);
  assert.deepEqual(mergeHeld(updated, [changed], new Set([records[0].key]), '2026-11-24'), []);
});

test('stale key is skipped without fetching', async t => {
  const { run, writeHeld } = setup(t);
  writeHeld([{ ...mergeHeld([], [heldInput], new Set(), today)[0], attempts: 8, stale: true }]);
  assert.deepEqual(await run({ fetchPage: async () => assert.fail('unexpected fetch') }), {
    ...empty, stale: 1, skippedStale: 1,
  });
});

test('crash recovery: event file present, held list stale → re-run returns alreadyPublished and clears the hold', async t => {
  const { run, writeHeld, heldPath } = setup(t);
  assert.deepEqual(await run(), { ...empty, published: [id] });
  const retry = candidate({ source: { url: 'https://tech.eu/another-link', publisher: 'tech.eu' } });
  const records = mergeHeld([], [{ ...heldInput, sourceUrl: retry.source.url }], new Set(), '2026-11-15');
  writeHeld(records);
  assert.deepEqual(await run({ input: [retry] }), { ...empty, alreadyPublished: [id] });
  assert.equal(readFileSync(heldPath, 'utf8'), '[]\n');
});

test('existing event file with an id collision throws on write', async t => {
  const { run, eventPath } = setup(t);
  await run();
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  event.source = { url: 'https://tech.eu/different-story', finalUrl: 'https://tech.eu/different-story', publisher: 'tech.eu' };
  event.happenedOn = '2026-10-01';
  const original = JSON.stringify(event);
  writeFileSync(eventPath, original);
  await assert.rejects(run(), { code: 'EEXIST' });
  assert.equal(readFileSync(eventPath, 'utf8'), original);
});

test('dry run writes nothing', async t => {
  const { run, root, heldPath } = setup(t);
  rmSync(heldPath);
  assert.deepEqual(await run({ dryRun: true }), { ...empty, published: [id] });
  assert.ok(!existsSync(join(root, 'src/content/events')));
  assert.ok(!existsSync(heldPath));
});

test('network failure holds as source-unreachable', async t => {
  const { run, eventPath, heldPath } = setup(t);
  assert.deepEqual(await run({ fetchPage: async url => ({ status: 0, contentType: '', html: '', finalUrl: url }) }), {
    ...empty, held: { 'source-unreachable': 1 },
  });
  assert.ok(!existsSync(eventPath));
  assert.equal(JSON.parse(readFileSync(heldPath, 'utf8'))[0].reason, 'source-unreachable');
});

test('invalid held list stops the run before fetching or writing', async t => {
  const { run, heldPath, eventPath } = setup(t);
  const raw = JSON.stringify([{ ...mergeHeld([], [heldInput], new Set(), today)[0], summary: 'private' }]);
  writeFileSync(heldPath, raw);
  await assert.rejects(run({ fetchPage: async () => assert.fail('unexpected fetch') }), /events-held\.json/);
  assert.equal(readFileSync(heldPath, 'utf8'), raw);
  assert.ok(!existsSync(eventPath));
});

test('event loader rejects invalid files and duplicate ids', async t => {
  const { run, root, eventPath } = setup(t);
  await run();
  const other = join(root, 'src/content/events/2026/other.json');
  writeFileSync(other, readFileSync(eventPath));
  assert.throws(() => loadExistingEvents(root), /duplicate event id/i);
  writeFileSync(other, '{}');
  assert.throws(() => loadExistingEvents(root), /other\.json/);
});

test('pointer-only submitted URL is held without fetching', async t => {
  const { run } = setup(t);
  const source = { url: 'https://quantumcomputingreport.com/release', publisher: 'Quantum Computing Report' };
  assert.deepEqual(await run({
    input: [candidate({ source })],
    fetchPage: async () => assert.fail('unexpected fetch'),
  }), { ...empty, held: { 'pointer-only': 1 } });
});

test('held-list IO round-trips new hold reasons and rejects mismatched keys before writing', t => {
  const { root, heldPath } = setup(t);
  rmSync(heldPath);
  assert.deepEqual(readHeldList(root), []);
  const records = mergeHeld([], [
    { ...heldInput, reason: 'homepage-url' },
    { ...heldInput, sourceUrl: 'https://tech.eu/other', reason: 'not-extracted' },
  ], new Set(), today);
  writeHeldList(root, records);
  assert.deepEqual(readHeldList(root), records);
  assert.ok(!existsSync(heldPath + '.tmp'));
  const raw = readFileSync(heldPath, 'utf8');
  assert.throws(() => writeHeldList(root, [{ ...records[0], key: 'wrong' }]),
    /Held key does not match its source/);
  assert.equal(readFileSync(heldPath, 'utf8'), raw);
});

test('a future happenedOn with implicit foundOn is invalid and the batch continues', async t => {
  const { run, heldPath } = setup(t);
  const summary = await run({ input: [
    candidate(),
    candidate({ happenedOn: '2026-11-23' }),
    candidate({ entities: ['companies/ghost'] }),
  ] });
  assert.deepEqual(summary, {
    ...empty,
    published: [id],
    invalid: [{ index: 1, error: 'foundOn is before happenedOn' }],
    held: { 'entity-unpublished': 1 },
  });
  assert.equal(JSON.parse(readFileSync(heldPath, 'utf8'))[0].reason, 'entity-unpublished');
});

test('a crash leftover is ignored and publishing removes its own temporary file', async t => {
  const { run, eventPath } = setup(t);
  const dir = dirname(eventPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'x.json.tmp'), '{"truncated":');
  writeFileSync(eventPath + '.tmp', '{"truncated":');
  assert.deepEqual(await run(), { ...empty, published: [id] });
  assert.equal(JSON.parse(readFileSync(eventPath, 'utf8')).id, id);
  assert.ok(!existsSync(eventPath + '.tmp'));
});
