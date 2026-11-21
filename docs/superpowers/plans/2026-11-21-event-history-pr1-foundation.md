# Event history, PR 1: schema, checker, JSON feed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `events` content collection, a deterministic checker that sorts event candidates into published events or a held list, and the `/events.json` + `/event.schema.json` endpoints. No UI.

**Architecture:** The event schema lives in a plain module (`src/lib/events/schema.ts`), so the Astro collection, the checker, the endpoints and the tests share one definition. The checker separates pure judgement (`checkCandidate`, given an already-fetched page) from I/O (`runCheck`, which fetches, writes event files and updates `data/events-held.json`). Tests inject a fake fetch, so there is no network in tests.

**Tech Stack:** Astro 7 content collections, Zod v4 (`zod` package, `z.toJSONSchema`), TypeScript run by `tsx`, `node:test`, Node 24 global `fetch`, `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-11-21-event-history-design.md` (§1 record, §2 checker, §5 `/events.json`, Future-proofing table, PR breakdown item 1). Later PRs (backfill, UI, rulebook, routine, clean-up) get their own plans.

## Global Constraints

- Six types: `funding` · `partnership` · `product` · `people` · `corporate` · `other`. `subtype` is allowed only on `corporate`: `acquisition | merger | listing | closure`.
- `id` = `<primary-slug>-<happenedOn>-<type>-<first 6 hex of sha256(normalised source.url)>`. It never changes once written.
- `summary` ≤140 characters (our words). `quote` ≤300 characters, verbatim, one sentence.
- `funding`: `{ amount: number | null, currency: ISO-4217 string | null, round: pre-seed | seed | series-a | series-b | series-c-plus | grant | debt | ipo | undisclosed | other, investors: string[] }`. Required when `type` is `funding`. `amount: null` means undisclosed.
- `origin`: `refresh | backfill | manual | fact-diff`. `schemaVersion: 1`. `checks.checkerVersion: 1`.
- A published event has every check `true`, except `amountInQuote`, which is `null` when not applicable.
- Pointer-only domains: `thequantuminsider.com`, `quantumcomputingreport.com`.
- Date tolerance ±3 days. Duplicate window ±7 days. Held candidates go stale after 8 attempts.
- **The held list never stores summary or quote.**
- "Credible" is decided only by `isCredibleSource` (`src/lib/source-bar.ts`).
- A company's own site counts only for events whose primary entity is that company, and the summary must contain "announced" (case-insensitive).
- Nothing in the Vercel build may read git history. No GitHub Actions; add nothing under `.github/workflows/`.
- No new runtime dependencies.
- Tests use `node:test` + `node:assert/strict`, live under `scripts/` or `src/lib/` (picked up by `scripts/run-tests.ts`), and make no network calls.
- Directory rules: never commit to `main`; branch `feature/event-history-foundation`; `npm run gate` green before pushing.

## Review Focus

1. **Client-rendered pages** (text only inside `<script>`): expect a hold with `quote-not-found`, not a crash or a pass. Test in Task 4.
2. **The same story under URL variants** (`?utm_source=…`, trailing slash, `www.`, `#fragment`): expect `possible-duplicate`, and identical ids. Tests in Tasks 2 and 4.
3. **Non-HTML sources** (PDF releases, arXiv PDFs): expect a hold with `source-not-html`, not a false `quote-not-found`. Test in Task 4.
4. **Typographic differences** (curly vs straight quotes, `&nbsp;`, `&amp;`, en/em dashes, line breaks inside the quote): expect the quote to match. Test in Task 3.
5. **Amount formats** (`€12M`, `EUR 12 million`, `$1.2bn`, `12,5 mio.`): expect a match within 0.5%, and `125` must not match `12.5`. Test in Task 3.

---

### Task 1: Move the credibility definition into `src/lib/`

`src/lib/source-bar.ts` imports `isBlocklistedSource` from `scripts/ai-sweep.mjs`, which PR 6 deletes. Move it first so the site no longer depends on the sweep.

**Files:**
- Create: `src/lib/credibility.mjs` (plain JS, so both `node` scripts and TS can import it)
- Create: `src/lib/credibility.test.ts`
- Modify: `scripts/ai-sweep.mjs:89-112` (delete the definitions; re-export from the new module)
- Modify: `src/lib/source-bar.ts:1-14` (import path and the header comment)

**Interfaces:**
- Produces: `isBlocklistedSource(item: { url?: string; source?: string }): boolean`, `BLOCKLISTED_DOMAINS: string[]` from `src/lib/credibility.mjs`. `scripts/ai-sweep.mjs` keeps exporting `isBlocklistedSource` and `credibleSourceCount` (re-exported or delegating), so `ai-sweep.test.ts` and `audit-sources.mjs` keep working.

- [ ] **Step 1: Set up the worktree.** `git -C ~/Developer/kvantiq-directory fetch origin`, then `git -C ~/Developer/kvantiq-directory worktree add ~/Developer/.worktrees/events-foundation -b feature/event-history-foundation origin/main`, then `npm --prefix ~/Developer/.worktrees/events-foundation ci`. Do not symlink: the main checkout's `node_modules` is incomplete (no `astro`). Expected: `npm --prefix ~/Developer/.worktrees/events-foundation test` passes on a clean tree.
- [ ] **Step 2: Write the failing test** `src/lib/credibility.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlocklistedSource } from './credibility.mjs';
import { isBlocklistedSource as viaSweep } from '../../scripts/ai-sweep.mjs';

test('credibility: same verdicts as the sweep used to give', () => {
  assert.ok(isBlocklistedSource({ url: 'https://www.linkedin.com/company/x', source: 'LinkedIn' }));
  assert.ok(isBlocklistedSource({ url: 'https://example.com/x', source: 'Crunchbase' }));
  assert.ok(isBlocklistedSource({ url: 'https://news.businesswire.com/x', source: '' }));
  assert.ok(!isBlocklistedSource({ url: 'https://www.reuters.com/x', source: 'Reuters' }));
});

test('credibility: ai-sweep re-exports the same function', () => {
  assert.equal(viaSweep, isBlocklistedSource);
});
```

- [ ] **Step 3: Run** `npm --prefix ~/Developer/.worktrees/events-foundation test`. Expected: FAIL, cannot find `./credibility.mjs`.
- [ ] **Step 4: Implement.** Move `getDomain`, `BLOCKLISTED_DOMAINS`, `BLOCKLISTED_SOURCE_RE` and `isBlocklistedSource` verbatim into `src/lib/credibility.mjs`, carrying the comment block over. In `ai-sweep.mjs`, use `export { isBlocklistedSource } from '../src/lib/credibility.mjs'` plus an import for internal use. Keep `credibleSourceCount` in `ai-sweep.mjs`, calling the imported function. Point `source-bar.ts` at `./credibility.mjs`, and update its header comment to name the new file as canonical.
- [ ] **Step 5: Run** `npm --prefix ~/Developer/.worktrees/events-foundation test` and `npm --prefix ~/Developer/.worktrees/events-foundation run type-check`. Expected: all pass, 0 errors.
- [ ] **Step 6: Commit** `refactor(credibility): Move source blocklist into src/lib`, with the body: "The site's publish gate imported it from the sweep script, which is being retired."

### Task 2: Event schema, id and URL normalisation

**Files:**
- Create: `src/lib/events/url.ts`
- Create: `src/lib/events/schema.ts`
- Create: `src/lib/events/pointer-domains.ts`
- Create: `src/lib/events/schema.test.ts`
- Modify: `src/content.config.ts` (add the `events` collection; extend `collections` export at `:148`)

**Interfaces:**
- Produces from `url.ts`: `normalizeUrl(url: string): string`. Lower-cases the host, strips `www.`, drops the fragment and every `utm_*` parameter, drops one trailing `/` from a non-root path, and keeps the scheme. `hostOf(url: string): string` returns the normalised host or `''`.
- Produces from `schema.ts`:
  - `EVENT_TYPES` (the six, `as const`), `type EventType`
  - `EVENT_TYPE_LABELS: Record<EventType, string>`: `Funding`, `Partnerships & contracts`, `Products & milestones`, `People`, `Corporate`, `Other`
  - `CORPORATE_SUBTYPES`, `FUNDING_ROUNDS`, `EVENT_ORIGINS`
  - `eventSchema` (Zod object), `type EventRecord = z.infer<typeof eventSchema>`
  - `computeEventId(primaryEntity: string, happenedOn: string, type: EventType, sourceUrl: string): string`, where the slug is the part of `primaryEntity` after `/`
  - `eventFilePath(record: Pick<EventRecord, 'id' | 'happenedOn'>): string` → `src/content/events/<YYYY>/<id>.json`
- Produces from `pointer-domains.ts`: `POINTER_ONLY_DOMAINS: readonly string[]`.
- `eventSchema` must use **no transforms or pipes**, so `z.toJSONSchema(eventSchema)` works. Import `z` from `zod`. It must check: `entities` min 1, each matching `^(companies|benchmarks|use-cases|challenges|resources)/[a-z0-9-]+$`; dates `^\d{4}-\d{2}-\d{2}$`; `checks.*` as `z.literal(true)` except `amountInQuote: z.literal(true).nullable()`; and a `superRefine` that rejects `funding == null` when `type === 'funding'`, a non-null `funding` otherwise, a `subtype` unless `type === 'corporate'`, and an `id !== computeEventId(entities[0], happenedOn, type, source.url)`. `change` is `{ field: string, from: z.json(), to: z.json() } | null`.

- [ ] **Step 1: Write the failing tests** in `src/lib/events/schema.test.ts`. Use a `valid()` factory that returns a complete funding event built with `computeEventId`:

```ts
test('url: variants of one story normalise to one URL', () => {
  const a = normalizeUrl('https://www.example.com/news/raise/?utm_source=x&id=7#top');
  assert.equal(a, 'https://example.com/news/raise?id=7');
  assert.equal(normalizeUrl('https://example.com/news/raise'), 'https://example.com/news/raise');
});
test('id: stable, formatted, and URL-variant-proof', () => {
  const id = computeEventId('companies/iqm', '2026-07-08', 'partnership', 'https://lumi.eu/a?utm_medium=y');
  assert.match(id, /^iqm-2026-07-08-partnership-[0-9a-f]{6}$/);
  assert.equal(id, computeEventId('companies/iqm', '2026-07-08', 'partnership', 'https://www.lumi.eu/a/'));
});
test('schema: a complete funding event parses', () => { assert.ok(eventSchema.safeParse(valid()).success); });
test('schema: funding type without funding object fails', () => { assert.ok(!eventSchema.safeParse({ ...valid(), funding: null }).success); });
test('schema: any false check fails', () => { const e = valid(); e.checks.quoteFound = false as never; assert.ok(!eventSchema.safeParse(e).success); });
test('schema: subtype on a non-corporate event fails', () => { assert.ok(!eventSchema.safeParse({ ...valid(), subtype: 'merger' }).success); });
test('schema: summary of 141 chars fails', () => { assert.ok(!eventSchema.safeParse({ ...valid(), summary: 'x'.repeat(141) }).success); });
test('schema: quote of 301 chars fails', () => { assert.ok(!eventSchema.safeParse({ ...valid(), quote: 'x'.repeat(301) }).success); });
test('schema: id not matching its fields fails', () => { assert.ok(!eventSchema.safeParse({ ...valid(), id: 'iqm-2026-07-08-funding-000000' }).success); });
test('schema: exports as JSON Schema', () => { assert.equal(typeof z.toJSONSchema(eventSchema), 'object'); });
test('path: year folder from happenedOn', () => { assert.equal(eventFilePath({ id: 'a-2026-07-08-other-abcdef', happenedOn: '2026-07-08' }), 'src/content/events/2026/a-2026-07-08-other-abcdef.json'); });
```

- [ ] **Step 2: Run** `npm --prefix ~/Developer/.worktrees/events-foundation test`. Expected: FAIL, modules missing.
- [ ] **Step 3: Implement** the three modules to the interfaces above. `computeEventId` hashes `normalizeUrl(sourceUrl)` with `createHash('sha256')` from `node:crypto`.
- [ ] **Step 4: Register the collection** in `src/content.config.ts`: `const events = defineCollection({ loader: glob({ pattern: '**/*.json', base: './src/content/events' }), schema: eventSchema })`, and add `events` to `collections`. Create `src/content/events/.gitkeep`.
- [ ] **Step 5: Run** `test`, `type-check` and `npm --prefix ~/Developer/.worktrees/events-foundation run build > ~/Developer/.worktrees/events-foundation/build-debug.log 2>&1; tail -20 ~/Developer/.worktrees/events-foundation/build-debug.log`. Expected: tests pass, 0 type errors, build succeeds. A "no files found" warning for `events` is acceptable.
- [ ] **Step 6: Commit** `feat(events): Add event schema and collection`.

### Task 3: Page analysis helpers

**Files:**
- Create: `scripts/events/page.ts`
- Create: `scripts/events/page.test.ts`
- Create: `scripts/events/fixtures/funding-release.html` (a realistic press release with `<meta property="article:published_time" content="2026-11-18T09:00:00Z">`, a JSON-LD `datePublished`, a curly-quoted sentence containing "€12M", nav and footer noise, and `&nbsp;`/`&amp;` entities)

**Interfaces:**
- Produces:
  - `htmlToText(html: string): string`: drops `<script>`, `<style>`, `<noscript>`, `<template>` and their contents, strips tags, decodes named entities (`amp lt gt quot apos nbsp ndash mdash lsquo rsquo ldquo rdquo hellip`) and numeric ones, and collapses whitespace.
  - `normalizeForMatch(s: string): string`: lower-case, NFKC, maps curly quotes to straight ones and en/em dashes to `-`, collapses whitespace.
  - `quoteFound(quote: string, pageText: string): boolean`: substring test on both sides normalised.
  - `publishedDates(html: string): string[]`: `YYYY-MM-DD` values from `article:published_time`, `<meta name="date">`, `<meta itemprop="datePublished">`, JSON-LD `"datePublished"` and `<time datetime>`.
  - `dateFound(happenedOn: string, html: string, pageText: string): boolean`: true if any published date is within ±3 days, or `happenedOn` appears in the text as `YYYY-MM-DD`, `D Month YYYY`, `Month D, YYYY` or `DD.MM.YYYY` (English month names, optional leading zero).
  - `amountInQuote(amount: number, quote: string): boolean`: parses every number in the quote with an optional multiplier (`k`, `m`, `mn`, `mio`, `million`, `b`, `bn`, `billion`; case-insensitive; `,` or `.` as decimal separator when followed by 1–2 digits), and returns true if any value is within 0.5% of `amount`.

- [ ] **Step 1: Write the failing tests:**

```ts
test('text: scripts and styles are removed, entities decoded', () => {
  const t = htmlToText('<p>A&nbsp;&amp;&nbsp;B</p><script>var x="hidden"</script><style>p{}</style>');
  assert.equal(t, 'A & B');
});
test('quote: curly quotes, dashes and line breaks still match', () => {
  assert.ok(quoteFound('"We\'re thrilled" - CEO', normalizeForMatch('“We’re\n thrilled” — CEO said')));
});
test('quote: absent text does not match', () => { assert.ok(!quoteFound('raised €40M', 'raised €12M today')); });
test('date: metadata within ±3 days counts', () => {
  const html = readFileSync(new URL('./fixtures/funding-release.html', import.meta.url), 'utf8');
  assert.ok(dateFound('2026-11-20', html, htmlToText(html)));
  assert.ok(!dateFound('2026-11-25', html, htmlToText(html)));
});
test('date: text formats count', () => {
  for (const s of ['on 2026-07-08', 'on 8 July 2026', 'on July 8, 2026', 'on 08.07.2026'])
    assert.ok(dateFound('2026-07-08', '<p></p>', s), s);
});
test('amount: formats', () => {
  assert.ok(amountInQuote(12_000_000, 'raised €12M in a seed round'));
  assert.ok(amountInQuote(12_000_000, 'EUR 12 million'));
  assert.ok(amountInQuote(1_200_000_000, 'a $1.2bn valuation'));
  assert.ok(amountInQuote(12_500_000, 'rejste 12,5 mio. kr.'));
  assert.ok(!amountInQuote(125_000_000, 'raised €12.5M'));
});
```

- [ ] **Step 2: Run** `test`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement** `scripts/events/page.ts` to the interfaces. Use regexes only; add no dependency.
- [ ] **Step 4: Run** `test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(events): Add page text, date and amount checks`.

### Task 4: `checkCandidate`, the judgement

**Files:**
- Create: `scripts/events/check.ts`
- Create: `scripts/events/check.test.ts`
- Create: `scripts/events/fixtures/client-rendered.html` (body is only `<div id="root"></div><script>…the quote text…</script>`)

**Interfaces:**
- Consumes: `eventSchema`, `computeEventId`, `EventType` (Task 2); `normalizeUrl`, `hostOf` (Task 2); `POINTER_ONLY_DOMAINS` (Task 2); `isCredibleSource` (`src/lib/source-bar.ts`); `htmlToText`, `quoteFound`, `normalizeForMatch`, `dateFound`, `amountInQuote` (Task 3).
- Produces:

```ts
export type EventCandidate = {
  entities: string[]; type: EventType; subtype?: string | null;
  happenedOn: string; foundOn?: string;              // foundOn set by backfill only
  summary: string; quote: string;
  source: { url: string; publisher: string; publishedOn?: string };
  pointers?: string[]; funding?: EventRecord['funding']; change?: EventRecord['change'];
  origin: EventRecord['origin']; typeSecondOpinion?: EventType;
};
export type FetchedPage = { ok: boolean; status: number; contentType: string; html: string; finalUrl: string };
export type EntityInfo = { key: string; name: string; published: boolean; websiteHost: string | null; country: string | null };
export type CheckContext = {
  page: FetchedPage; entities: Map<string, EntityInfo>;
  existing: Array<Pick<EventRecord, 'id' | 'entities' | 'type' | 'happenedOn' | 'source'>>;
  today: string;
};
export type HoldReason =
  | 'invalid-candidate' | 'unknown-entity' | 'entity-unpublished'
  | 'source-unreachable' | 'source-not-html' | 'source-not-credible'
  | 'self-published-other' | 'self-published-wording' | 'pointer-only'
  | 'quote-not-found' | 'date-not-found' | 'amount-not-in-quote'
  | 'type-unchecked' | 'type-disagreement' | 'possible-duplicate';
export type Verdict = { status: 'publish'; record: EventRecord } | { status: 'hold'; reason: HoldReason };
export function checkCandidate(c: EventCandidate, ctx: CheckContext): Verdict;
```

- The checks run in this order and the first failure wins:
  - **invalid-candidate:** summary >140, quote >300, a bad date, an empty `entities`, or `funding` missing for type `funding`.
  - **unknown-entity**, then **entity-unpublished:** every entity must exist and be published.
  - **source-unreachable:** `!page.ok`. **source-not-html:** the content type doesn't contain `text/html`.
  - **source-not-credible:** `isCredibleSource({ url, title: publisher })` is false.
  - **Self-published rule:** the source host equals the `websiteHost` of a **company** entity. If that company is not `entities[0]`, hold `self-published-other`. If it is, but the summary lacks "announced", hold `self-published-wording`.
  - **pointer-only:** the source host equals or ends with `.`+ a pointer domain.
  - **quote-not-found**, **date-not-found**, **amount-not-in-quote** (only when `type === 'funding'` and `funding.amount !== null`).
  - **type-unchecked** (no `typeSecondOpinion`), **type-disagreement**.
  - **possible-duplicate:** an existing record has the same `normalizeUrl(source.url)`, or the same `entities[0]` and `type` with `happenedOn` within ±7 days.
- On publish, the record has `schemaVersion: 1`, `id` from `computeEventId`, `foundOn = c.foundOn ?? ctx.today`, `pointers ?? []`, `subtype ?? null`, `funding ?? null` and `change ?? null`. `checks` is all `true`, with `amountInQuote: true | null`, `checkerVersion: 1` and `checkedOn: ctx.today`. The record must pass `eventSchema.parse`.

- [ ] **Step 1: Write the failing tests.** Use a `ctx()` factory containing two published companies: `companies/qilimanjaro` (`websiteHost: 'qilimanjaro.tech'`) and `companies/iqm` (`meetiqm.com`). Add one unpublished entity, `companies/ghost`. Start from a candidate whose page is `funding-release.html` served from `https://tech.eu/…`. Then, **one test per hold reason**, each mutating a single field, plus:

```ts
test('clean candidate publishes a schema-valid record', () => {
  const v = checkCandidate(candidate(), ctx());
  assert.equal(v.status, 'publish');
  assert.ok(eventSchema.safeParse((v as any).record).success);
  assert.equal((v as any).record.foundOn, '2026-11-23');
});
test('own announcement about itself publishes when worded "announced"', () => {
  const c = candidate({ source: { url: 'https://qilimanjaro.tech/news/a', publisher: 'Qilimanjaro' }, summary: 'Qilimanjaro announced a €12M Series A' });
  assert.equal(checkCandidate(c, ctx({ finalUrl: 'https://qilimanjaro.tech/news/a' })).status, 'publish');
});
test('a company site about another company is held', () => {
  const c = candidate({ source: { url: 'https://meetiqm.com/press/x', publisher: 'IQM' } });
  assert.deepEqual(checkCandidate(c, ctx()), { status: 'hold', reason: 'self-published-other' });
});
test('client-rendered page holds as quote-not-found', () => { /* page html = client-rendered.html */ });
test('PDF source holds as source-not-html', () => { /* contentType 'application/pdf' */ });
test('URL variant of an existing event holds as possible-duplicate', () => { /* existing has same URL without ?utm_source */ });
test('backfill foundOn is kept', () => { /* candidate({ foundOn: '2026-05-02', origin: 'backfill' }) → record.foundOn === '2026-05-02' */ });
```

- [ ] **Step 2: Run** `test`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement** `checkCandidate` to the interface and order above.
- [ ] **Step 4: Run** `test`. Expected: PASS, with one test per `HoldReason` member.
- [ ] **Step 5: Commit** `feat(events): Add candidate checker`.

### Task 5: `runCheck`, held list and CLI

**Files:**
- Create: `scripts/events/held.ts`
- Create: `scripts/events/run.ts`
- Create: `scripts/events/check-cli.ts`
- Create: `scripts/events/run.test.ts`
- Modify: `package.json` scripts (add `"events:check": "tsx scripts/events/check-cli.ts"`)
- Create: `data/events-held.json` containing `[]`

**Interfaces:**
- Consumes: `checkCandidate`, `EventCandidate`, `FetchedPage`, `EntityInfo`, `HoldReason` (Task 4); `eventFilePath`, `normalizeUrl` (Task 2); `isPublished` (`src/lib/source-bar.ts`).
- Produces from `held.ts`:

```ts
export type HeldRecord = {
  key: string;                // `${entities[0]}|${normalizeUrl(sourceUrl)}`; stable across re-extractions
  entities: string[]; sourceUrl: string; reason: HoldReason;
  firstHeldOn: string; lastCheckedOn: string; attempts: number; stale: boolean;
};
export const STALE_AFTER_ATTEMPTS = 8;
export function heldKey(entities: string[], sourceUrl: string): string;
export function mergeHeld(previous: HeldRecord[], holds: Array<{ candidate: EventCandidate; reason: HoldReason }>,
                          publishedKeys: Set<string>, today: string): HeldRecord[];
```
  `mergeHeld` handles four cases. A key that is held again gets `attempts+1`, its reason and `lastCheckedOn` updated, and `stale = attempts >= 8`. A new key starts at `attempts: 1`. A previous key in `publishedKeys` is removed. A previous key untouched this run is kept as-is. The output is sorted by key. A record is built from exactly the `HeldRecord` fields: **never summary or quote.**
  Key note: the spec's `candidateId` became `key`, because a re-extraction may change the type or date, and so the id.
- Produces from `run.ts`:

```ts
export type RunOptions = { root: string; candidates: EventCandidate[]; today: string; dryRun: boolean;
                           fetchPage: (url: string) => Promise<FetchedPage> };
export type RunSummary = { published: string[]; held: Record<string, number>; stale: number; skippedStale: number };
export function loadEntityIndex(root: string): Map<string, EntityInfo>;   // reads src/content/<collection>/*.json
export function loadExistingEvents(root: string): EventRecord[];          // reads src/content/events/**/*.json
export function runCheck(opts: RunOptions): Promise<RunSummary>;
export function fetchPageLive(url: string): Promise<FetchedPage>;         // global fetch, 20 s timeout, redirect: 'follow',
                                                                          // UA 'KvantiqDirectoryEventChecker/1.0 (+https://directory.kvantiq.studio/about/)'
```
  - **`loadEntityIndex`:** sets `websiteHost` from `hostOf(data.website)` for `companies` only (null for other collections), and `published` from `isPublished(data)`.
  - **`runCheck` and stale keys:** it skips any candidate whose key is already `stale` (counted in `skippedStale`, not re-fetched).
  - **Batch duplicates:** every published record joins `existing` immediately, so two candidates in one batch can't both publish.
  - **Writes:** unless `dryRun`, it writes each record to `eventFilePath(record)` as `JSON.stringify(record, null, 2) + '\n'`, and writes `data/events-held.json` the same way.
  - **Network failures:** `fetchPageLive` catches them and returns `{ ok: false, status: 0, … }`.
- `check-cli.ts` usage: `npm run events:check -- --candidates <file.json> [--today YYYY-MM-DD] [--dry-run]`. It prints the `RunSummary` as JSON and exits 0 even when items are held. It exits 1 only on unreadable input.

- [ ] **Step 1: Write the failing tests** in `scripts/events/run.test.ts`, against a temp dir (`mkdtempSync`) seeded with two company JSON files (one published with 3 credible sources, one with 1), the fixture page, and a fake `fetchPage`:

```ts
test('publishes a clean candidate and writes its file', async () => { /* expect file at eventFilePath(record), summary.published.length === 1 */ });
test('two candidates with the same URL: one published, one possible-duplicate', async () => {});
test('held record carries no summary or quote', async () => {
  const held = JSON.parse(readFileSync(join(root, 'data/events-held.json'), 'utf8'));
  assert.deepEqual(Object.keys(held[0]).sort(), ['attempts','entities','firstHeldOn','key','lastCheckedOn','reason','sourceUrl','stale']);
  assert.ok(!JSON.stringify(held).includes(candidate().quote));
});
test('mergeHeld: 8th consecutive hold marks stale; published key is removed', () => {});
test('stale key is skipped without fetching', async () => { /* fetchPage spy not called */ });
test('dry run writes nothing', async () => {});
test('network failure holds as source-unreachable', async () => { /* fetchPage returns ok:false status 0 */ });
```

- [ ] **Step 2: Run** `test`. Expected: FAIL.
- [ ] **Step 3: Implement** `held.ts`, `run.ts`, `check-cli.ts` and the `package.json` script.
- [ ] **Step 4: Run** `test`, then a real dry run against the repo:

```bash
printf '[]' > "${TMPDIR:-/tmp}/empty-candidates.json"
npm --prefix ~/Developer/.worktrees/events-foundation run events:check -- --candidates "${TMPDIR:-/tmp}/empty-candidates.json" --dry-run
```
  Expected: tests pass, and the CLI prints `{"published":[],"held":{},"stale":0,"skippedStale":0}`.
- [ ] **Step 5: Commit** `feat(events): Add checker CLI and held list`.

### Task 6: `/events.json` and `/event.schema.json`

**Files:**
- Create: `src/lib/events/feed.ts`
- Create: `src/lib/events/feed.test.ts`
- Create: `src/pages/events.json.ts`
- Create: `src/pages/event.schema.json.ts`

**Interfaces:**
- Consumes: `EventRecord`, `eventSchema` (Task 2); `isPublished` (`source-bar.ts`).
- Produces:

```ts
export type FeedEntity = { name: string; country: string | null; href: string };
export type EventsFeed = { schemaVersion: 1; count: number; entities: Record<string, FeedEntity>; events: EventRecord[] };
export type FeedEntryInput = { collection: string; slug: string; name: string; country?: string; sources?: { url: string; title?: string }[] };
export function entityHref(collection: string, slug: string): string;
export function buildEventsFeed(events: EventRecord[], entries: FeedEntryInput[]): EventsFeed;
```
  - **`entityHref`:** companies → `/companies/<slug>/`, benchmarks → `/benchmarks/<slug>/`, use-cases → `/use-cases/<slug>/`, challenges → `/challenges/<slug>/`, resources → `/resources/#<slug>`.
  - **`buildEventsFeed`:** drops events whose `entities[0]` is not published, and sorts by `happenedOn` descending, then `id` ascending. `entities` covers only keys referenced by included events. No timestamps, so output is deterministic.
- `events.json.ts`: an `APIRoute` `GET` that reads `getCollection('events')` plus the five entry collections, and returns `new Response(JSON.stringify(feed), { headers: { 'Content-Type': 'application/json; charset=utf-8' } })`.
- `event.schema.json.ts`: an `APIRoute` returning `z.toJSONSchema(eventSchema)` with `$id: 'https://directory.kvantiq.studio/event.schema.json'`.

- [ ] **Step 1: Write the failing tests:**

```ts
test('feed: unpublished primary entity is excluded', () => {});
test('feed: newest first, ties by id', () => {});
test('feed: resource href is an anchor on /resources/', () => { assert.equal(entityHref('resources', 'qiskit'), '/resources/#qiskit'); });
test('feed: entities map has only referenced keys', () => {});
```

- [ ] **Step 2: Run** `test`. Expected: FAIL.
- [ ] **Step 3: Implement** `feed.ts` and both routes.
- [ ] **Step 4: Verify the build output:**

```bash
npm --prefix ~/Developer/.worktrees/events-foundation run build > ~/Developer/.worktrees/events-foundation/build-debug.log 2>&1; tail -5 ~/Developer/.worktrees/events-foundation/build-debug.log
node -e "const f=require('$HOME/Developer/.worktrees/events-foundation/dist/events.json'); console.log(f.schemaVersion, f.count, Array.isArray(f.events))"
node -e "const s=require('$HOME/Developer/.worktrees/events-foundation/dist/event.schema.json'); console.log(s.type, Object.keys(s.properties).length > 10)"
```
  Expected: build succeeds; prints `1 0 true` and `object true`.
- [ ] **Step 5: Commit** `feat(events): Serve events feed and JSON Schema`.

### Task 7: Gate and PR

- [ ] **Step 1: Run** `npm --prefix ~/Developer/.worktrees/events-foundation run gate > ~/Developer/.worktrees/events-foundation/gate-debug.log 2>&1; tail -20 ~/Developer/.worktrees/events-foundation/gate-debug.log`. Expected: type-check, test and build all green.
- [ ] **Step 2: Rebase** with `git -C ~/Developer/.worktrees/events-foundation fetch origin` and `git -C ~/Developer/.worktrees/events-foundation rebase origin/main`, then re-run the gate if anything moved.
- [ ] **Step 3: Push and open the PR.** Push with `git -C ~/Developer/.worktrees/events-foundation push -u origin feature/event-history-foundation`. Open it with `gh pr create -R de-Blanck/kvantiq-directory`, titled `feat(events): Add event schema, checker and JSON feed`. The body links the spec, lists the seven tasks, states "No UI changes; no events yet (backfill is PR 2)", and pastes the gate tail. **Do not add the `auto-merge` label.** Rune merges.
- [ ] **Step 4: Report** the PR URL and the gate result. After merge, `curl -s https://directory.kvantiq.studio/events.json | head -c 200` should return `{"schemaVersion":1,"count":0`. Until that has been run, report "merged but not verified".
