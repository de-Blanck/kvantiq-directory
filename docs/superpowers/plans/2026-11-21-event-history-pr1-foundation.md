# Event history, PR 1: schema, checker, JSON feed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision 2 (2026-11-21):** revised after Codex's critical review (3 blockers, 10 high-severity findings). The changes that matter:
- The id is assigned once at creation and never recomputed.
- The schema's structural rules are expressed as exportable Zod branches.
- Candidates are validated before use, and both the submitted and the final (post-redirect) URL go through source policy.
- Attempts are counted per ISO week, writes are atomic, and the feed applies the all-entities rule.
- Resource links fall back to `/resources/` until PR 3 adds anchors.

**Goal:** Add the `events` content collection, a deterministic checker that sorts event candidates into published events or a held list, and the `/events.json` + `/event.schema.json` endpoints. No UI.

**Architecture:** The event schema lives in a plain module (`src/lib/events/schema.ts`), so the Astro collection, the checker, the endpoints and the tests share one definition. Judgement (`checkCandidate`, given an already-fetched page) is pure. I/O (`runCheck`: validate input, fetch, write event files atomically, update `data/events-held.json`) is separate and takes an injected fetch, so there is no network in tests.

**Tech Stack:** Astro 7 content collections, Zod v4 (`zod` package, `z.toJSONSchema`), TypeScript run by `tsx`, `node:test`, Node 24 global `fetch`, `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-11-21-event-history-design.md` (§1 record, §2 checker, §5 `/events.json`, Future-proofing table, PR breakdown item 1). Later PRs get their own plans; see [Handoff](#handoff-to-later-prs).

## Global Constraints

- Six types: `funding` · `partnership` · `product` · `people` · `corporate` · `other`. `subtype` is allowed only on `corporate`: `acquisition | merger | listing | closure`.
- **`id` is assigned once, when the checker creates the event:** `<primary-slug>-<happenedOn>-<type>-<first 6 hex of sha256(normalizeUrl(source.url))>`. After creation it is validated **only for shape**, never recomputed, so correcting a field never breaks it. The file path (`src/content/events/<YYYY>/<id>.json`, year at creation) never moves either.
- `summary` 1–140 characters (our words). `quote` 20–300 characters, verbatim.
- `funding`: `{ amount: number | null, currency: ISO-4217 3-letter uppercase | null, round: pre-seed | seed | series-a | series-b | series-c-plus | grant | debt | ipo | undisclosed | other, investors: string[] }`. Required when `type` is `funding`, forbidden otherwise. `amount: null` means undisclosed.
- `checks.amountInQuote` is `true` when `type === 'funding'` and `funding.amount !== null`, and `null` in every other case.
- `origin`: `refresh | backfill | manual | fact-diff`. `schemaVersion: 1`. `checks.checkerVersion: 1`.
- Every other check is `true` on a published event.
- Source must return **HTTP 200** with `text/html`. Source policy applies to **both the submitted URL and the final URL** after redirects.
- Pointer-only domains: `thequantuminsider.com`, `quantumcomputingreport.com`.
- Date tolerance ±3 days. Duplicate window ±7 days. A held key goes stale after it has been held in 8 distinct ISO weeks.
- **The held list never stores summary or quote.**
- "Credible" is decided only by `isCredibleSource` (`src/lib/source-bar.ts`).
- A company's own site (its website host or any subdomain of it) counts only for events whose primary entity is that company, and the summary must start with `<that company's name> announced` (case-insensitive).
- An event is shown only if **every** entity it names is published.
- Nothing in the Vercel build may read git history. No GitHub Actions; add nothing under `.github/workflows/`.
- No new runtime dependencies.
- Tests use `node:test` + `node:assert/strict`, live under `scripts/` or `src/lib/`, and make no network calls.
- Log-and-tail commands keep the real exit status: `cmd > X-debug.log 2>&1; s=$?; tail -20 X-debug.log; test $s -eq 0`. `*-debug.log` is gitignored.
- Directory rules: never commit to `main`; branch `feature/event-history-foundation`; `npm run gate` green before pushing.

## Review Focus

1. **Client-rendered pages and 200 interstitials** (text only in `<script>`, "Just a moment…", cookie walls): expect `quote-not-found`, never a pass. Test in Task 4.
2. **URL variants and redirects** (`?utm_source=…`, trailing slash, `www.`, `#fragment`, a clean URL redirecting to a pointer-only or blocklisted host): expect `possible-duplicate` or `pointer-only`/`source-not-credible` on the final URL. Tests in Tasks 2 and 4.
3. **Non-HTML and non-200 sources** (PDF, 204, 301 without follow, 403): expect `source-not-html` or `source-unreachable`. Test in Task 4.
4. **Hidden or scattered text** (quote only inside `display:none` or `aria-hidden`, or split across two block elements): expect `quote-not-found`. Typographic variants (curly quotes, `&nbsp;`, dashes) still match. Tests in Task 3.
5. **Amounts** (valuation in the same quote, a different currency, `125` vs `12.5`, `€12M`, `EUR 12 million`, `12,5 mio. kr.`): match only a currency-tied amount within 0.5%, in the declared currency. Tests in Task 3.

---

### Task 1: Move the credibility definition into `src/lib/`

**Files:**
- Create: `src/lib/credibility.mjs`, `src/lib/credibility.test.ts`
- Modify: `scripts/ai-sweep.mjs:85-112`, `src/lib/source-bar.ts:1-14`

**Interfaces:**
- Produces from `src/lib/credibility.mjs`: `getDomain(url: string): string`, `BLOCKLISTED_DOMAINS: string[]`, `isBlocklistedSource(item: { url?: string; source?: string }): boolean`.
- `scripts/ai-sweep.mjs` imports `getDomain` and `isBlocklistedSource` from it (both are still used at `:132` and `:320`). It re-exports `isBlocklistedSource` and keeps exporting `credibleSourceCount` (used by `scripts/audit-sources.mjs:17`).

- [ ] **Step 1: Check the worktree.** It already exists. `git -C ~/Developer/.worktrees/events-foundation status --short` should print nothing, and `git -C ~/Developer/.worktrees/events-foundation branch --show-current` should print `feature/event-history-foundation`. `node_modules` is installed; run `npm --prefix ~/Developer/.worktrees/events-foundation ci` only if `node_modules/astro` is missing.
- [ ] **Step 2: Write the failing test** `src/lib/credibility.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlocklistedSource, getDomain } from './credibility.mjs';
import { isBlocklistedSource as viaSweep, credibleSourceCount } from '../../scripts/ai-sweep.mjs';

test('credibility: same verdicts as before the move', () => {
  assert.ok(isBlocklistedSource({ url: 'https://www.linkedin.com/company/x', source: 'LinkedIn' }));
  assert.ok(isBlocklistedSource({ url: 'https://example.com/x', source: 'Crunchbase' }));
  assert.ok(isBlocklistedSource({ url: 'https://news.businesswire.com/x', source: '' }));
  assert.ok(!isBlocklistedSource({ url: 'https://www.reuters.com/x', source: 'Reuters' }));
  assert.equal(getDomain('not a url'), '');
});
test('credibility: ai-sweep re-exports the same function and still counts', () => {
  assert.equal(viaSweep, isBlocklistedSource);
  assert.equal(credibleSourceCount([{ url: 'https://reuters.com/a' }, { url: 'https://linkedin.com/b' }]), 1);
});
```

- [ ] **Step 3: Run** `npm --prefix ~/Developer/.worktrees/events-foundation test`. Expected: FAIL, `./credibility.mjs` not found.
- [ ] **Step 4: Implement.** Move `getDomain`, `BLOCKLISTED_DOMAINS`, `BLOCKLISTED_SOURCE_RE` and `isBlocklistedSource` verbatim, with their comment block, into `src/lib/credibility.mjs`. In `ai-sweep.mjs`, import them and add `export { isBlocklistedSource }`. Point `source-bar.ts` at `./credibility.mjs`, and update its header comment to name the new file as canonical.
- [ ] **Step 5: Run** `test`, `type-check` and `npm --prefix ~/Developer/.worktrees/events-foundation run audit:sources > ~/Developer/.worktrees/events-foundation/audit-debug.log 2>&1; s=$?; tail -5 ~/Developer/.worktrees/events-foundation/audit-debug.log; test $s -eq 0`. Expected: all pass, 0 errors, and audit output unchanged from `main`.
- [ ] **Step 6: Commit** `refactor(credibility): Move source blocklist into src/lib`, with the body: "The site's publish gate imported it from the sweep script, which is being retired."

### Task 2: Event schema, id and URL normalisation

**Files:**
- Create: `src/lib/events/url.ts`, `src/lib/events/schema.ts`, `src/lib/events/pointer-domains.ts`, `src/lib/events/schema.test.ts`
- Modify: `src/content.config.ts` (add the `events` collection to `collections` at `:148`)
- Create: `src/content/events/.gitkeep`

**Interfaces:**
- Produces from `url.ts`:
  - `normalizeUrl(url: string): string`: lower-cases the host, strips `www.`, drops the fragment and every `utm_*` parameter, drops one trailing `/` from a non-root path, and keeps the scheme.
  - `hostOf(url: string): string`: the normalised host, or `''`.
  - `isHostOrSubdomain(host: string, domain: string): boolean`: true when `host === domain` or `host` ends with `.` + `domain`.
- Produces from `schema.ts`:
  - `EVENT_TYPES` (`as const`), `type EventType`; `EVENT_TYPE_LABELS: Record<EventType, string>` = `Funding`, `Partnerships & contracts`, `Products & milestones`, `People`, `Corporate`, `Other`
  - `CORPORATE_SUBTYPES`, `FUNDING_ROUNDS`, `EVENT_ORIGINS`
  - `isoDate`: a Zod string matching `^\d{4}-\d{2}-\d{2}$` **and** a real calendar date (refine via `Date.UTC` round-trip)
  - `eventSchema`, `type EventRecord = z.infer<typeof eventSchema>`
  - `computeEventId(primaryEntity: string, happenedOn: string, type: EventType, sourceUrl: string): string`. The slug is the part after `/`. It is used **only** by the checker at creation.
  - `eventFilePath(record: Pick<EventRecord, 'id' | 'happenedOn'>): string` → `src/content/events/<YYYY>/<id>.json`, used only at creation.
  - `RUNTIME_ONLY_RULES: string[]`: human-readable rules that JSON Schema can't express. It is put into the exported schema's `description`.
- Produces from `pointer-domains.ts`: `POINTER_ONLY_DOMAINS: readonly string[]`.
- **`eventSchema` shape.** Write it as `z.discriminatedUnion('type', […])` over a shared base, so the structural rules survive `z.toJSONSchema`. The `funding` branch requires the `funding` object. The `corporate` branch allows `subtype` (enum or null). The other four branches have `funding: z.null()` and `subtype: z.null()`.
  - Base fields: `schemaVersion: z.literal(1)`; `id` matching `^[a-z0-9-]+-\d{4}-\d{2}-\d{2}-(funding|partnership|product|people|corporate|other)-[0-9a-f]{6}$`; `entities` min 1, each `^(companies|benchmarks|use-cases|challenges|resources)/[a-z0-9-]+$`, unique; `happenedOn` and `foundOn` as `isoDate`; `summary`; `quote`; `source: { url: http(s) URL, publisher: non-empty, publishedOn: isoDate.optional() }`; `pointers: z.array(http(s) URL)`; `change: { field: string, from: z.json(), to: z.json() }.nullable()`; `origin`; and `checks` with every key `z.literal(true)` except `amountInQuote: z.literal(true).nullable()`, plus `checkerVersion: z.literal(1)` and `checkedOn: isoDate`.
  - **No transforms or pipes.** Import `z` from `zod`.
  - **Runtime-only rules** (a `superRefine` on the union, listed in `RUNTIME_ONLY_RULES`): `amountInQuote` is `true` iff the type is funding and `funding.amount` is non-null, `null` otherwise; `foundOn >= happenedOn` is **not** enforced (backfill can find old items late, so that's fine).

- [ ] **Step 1: Write the failing tests** in `src/lib/events/schema.test.ts`, with a `valid(overrides?)` factory returning a complete funding event:

```ts
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
```

- [ ] **Step 2: Run** `test`. Expected: FAIL, modules missing.
- [ ] **Step 3: Implement** the three modules to the interfaces.
- [ ] **Step 4: Register the collection** (`defineCollection({ loader: glob({ pattern: '**/*.json', base: './src/content/events' }), schema: eventSchema })`) and add `.gitkeep`.
- [ ] **Step 5: Run** `test`, `type-check`, then `npm --prefix ~/Developer/.worktrees/events-foundation run build > ~/Developer/.worktrees/events-foundation/build-debug.log 2>&1; s=$?; tail -20 ~/Developer/.worktrees/events-foundation/build-debug.log; test $s -eq 0`. Expected: all green. An empty-collection warning for `events` is acceptable.
- [ ] **Step 6: Commit** `feat(events): Add event schema and collection`.

### Task 3: Page analysis helpers

**Files:**
- Create: `scripts/events/page.ts`, `scripts/events/page.test.ts`
- Create: `scripts/events/fixtures/funding-release.html`. A realistic press release with:
  - `<meta property="article:published_time" content="2026-11-18T09:00:00Z">`
  - a JSON-LD `{"@type":"NewsArticle","datePublished":"2026-11-18"}`, plus a second JSON-LD block of `@type` `WebPage` dated `2025-01-01`
  - a "Related stories" list with `<time datetime="2026-11-25">`
  - a curly-quoted sentence with "€12M" and an "€80M valuation" in the same paragraph
  - `&nbsp;`/`&amp;`, a `<div style="display:none">` and an `aria-hidden="true"` span holding decoy text

**Interfaces:**
- Produces:
  - `htmlToText(html: string): string`. It drops `<script>`, `<style>`, `<noscript>`, `<template>`, `<head>`, and any element with a `hidden` attribute, `aria-hidden="true"` or an inline `display:none`/`visibility:hidden`, contents included. Inline tags are stripped without a separator. Block tags (`p div li h1-h6 td th tr br section article header footer nav blockquote`) become the boundary token ` ¶ `. Named and numeric entities are decoded, and spaces collapse.
  - `normalizeForMatch(s: string): string`: lower-case, NFKC, curly quotes to straight, en/em dashes to `-`, collapsed whitespace. The ` ¶ ` token is kept.
  - `quoteFound(quote: string, pageText: string): boolean`: false for a normalised quote under 20 characters, or one containing `¶`. Otherwise a substring test on the normalised forms, so a quote can't span two blocks.
  - `publishedDates(html: string): string[]`: `YYYY-MM-DD` values only from `article:published_time`, `<meta name="date">`, `<meta itemprop="datePublished">`, and JSON-LD blocks whose `@type` is one of `NewsArticle | Article | BlogPosting | PressRelease | Report`. Generic `<time>` elements are **ignored**.
  - `dateFound(happenedOn: string, html: string, pageText: string): boolean`: true if any published date is within ±3 days, or `happenedOn` appears in the text as `YYYY-MM-DD`, `D Month YYYY`, `Month D, YYYY` or `DD.MM.YYYY` (English months, optional leading zero).
  - `amountInQuote(amount: number, currency: string | null, quote: string): boolean`. It matches only **currency-tied** amounts: a number directly preceded or followed (allowing one space) by a currency marker. The markers are `€ $ £` and the codes `EUR USD GBP DKK SEK NOK CHF`, plus `kr`/`kr.` meaning DKK, SEK or NOK. The multiplier is optional and case-insensitive: `k m mn mio million b bn billion`. `,` or `.` is a decimal separator only when followed by 1–2 digits; otherwise it groups thousands. Word boundaries apply, so `5m` inside `25mm` doesn't count. It returns true if some currency-tied value is within 0.5% of `amount` and, when `currency` is non-null, its marker maps to that currency (`€`→EUR, `$`→USD, `£`→GBP; codes map to themselves).

- [ ] **Step 1: Write the failing tests:**

```ts
const fx = readFileSync(new URL('./fixtures/funding-release.html', import.meta.url), 'utf8');
test('text: hidden elements and scripts removed, entities decoded', () => {
  const t = htmlToText('<p>A&nbsp;&amp;&nbsp;B</p><div style="display:none">decoy</div><span aria-hidden="true">decoy</span><script>x</script>');
  assert.equal(t.replace(/ ¶ /g, '').trim(), 'A & B');
});
test('quote: typographic variants match; inline tags do not break it', () =>
  assert.ok(quoteFound('"We\'re thrilled" - CEO says', htmlToText('<p>“We’re <b>thrilled</b>” — CEO says</p>'))));
test('quote: text split across two blocks does not match', () =>
  assert.ok(!quoteFound('first sentence second sentence', htmlToText('<p>first sentence</p><p>second sentence</p>'))));
test('quote: hidden decoy does not match', () => assert.ok(!quoteFound('decoy text that is hidden here', htmlToText(fx))));
test('quote: empty or short quote never matches', () => { assert.ok(!quoteFound('', 'anything')); assert.ok(!quoteFound('short', 'short')); });
test('date: article metadata within ±3 days counts; related-story <time> and WebPage JSON-LD do not', () => {
  assert.ok(dateFound('2026-11-20', fx, htmlToText(fx)));
  assert.ok(!dateFound('2026-11-25', fx, htmlToText(fx)));
  assert.ok(!dateFound('2025-01-01', fx, htmlToText(fx)));
});
test('date: text formats count', () => {
  for (const s of ['on 2026-07-08', 'on 8 July 2026', 'on July 8, 2026', 'on 08.07.2026']) assert.ok(dateFound('2026-07-08', '<p></p>', s), s);
});
test('amount: currency-tied formats match', () => {
  assert.ok(amountInQuote(12_000_000, 'EUR', 'raised €12M in a seed round'));
  assert.ok(amountInQuote(12_000_000, 'EUR', 'EUR 12 million'));
  assert.ok(amountInQuote(1_200_000_000, 'USD', 'a $1.2bn round'));
  assert.ok(amountInQuote(12_500_000, 'DKK', 'rejste 12,5 mio. kr.'));
  assert.ok(amountInQuote(1_250_000, null, '€1,250,000'));
});
test('amount: wrong magnitude, wrong currency, or bare number does not match', () => {
  assert.ok(!amountInQuote(125_000_000, 'EUR', 'raised €12.5M'));
  assert.ok(!amountInQuote(12_000_000, 'USD', 'raised €12M'));
  assert.ok(!amountInQuote(12_000_000, 'EUR', 'hired 12 million users'));
});
```

- [ ] **Step 2: Run** `test`. Expected: FAIL.
- [ ] **Step 3: Implement** `scripts/events/page.ts`. Regexes only, no dependency.
- [ ] **Step 4: Run** `test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(events): Add page text, date and amount checks`.

### Task 4: `checkCandidate`, the judgement

**Files:**
- Create: `scripts/events/candidate.ts`, `scripts/events/check.ts`, `scripts/events/check.test.ts`
- Create fixtures in `scripts/events/fixtures/`:
  - `client-rendered.html`: only `<div id="root"></div><script>` containing the quote
  - `interstitial.html`: a 200 "Just a moment… Enable JavaScript and cookies" page
  - `self-release.html`: Qilimanjaro's own release with the quote and a date

**Interfaces:**
- Consumes (from Tasks 1–3): `eventSchema`, `EventRecord`, `computeEventId`, `isoDate`, `EVENT_TYPES`, `normalizeUrl`, `hostOf`, `isHostOrSubdomain`, `POINTER_ONLY_DOMAINS`, all page helpers. Also `isCredibleSource` from `src/lib/source-bar.ts`.
- Produces from `candidate.ts`: `candidateSchema`, a Zod schema for untrusted input. Same field rules as `eventSchema`'s base, minus `id`, `checks` and `schemaVersion`, plus `foundOn: isoDate.optional()` and `typeSecondOpinion: z.enum(EVENT_TYPES).optional()`. `pointers` defaults to `[]`; `subtype`, `funding` and `change` default to `null`. It uses the same discriminated union by `type`, and adds `type EventCandidate = z.infer<typeof candidateSchema>`.
- Produces from `check.ts`:

```ts
export type FetchedPage = { status: number; contentType: string; html: string; finalUrl: string };
export type EntityInfo = { key: string; collection: string; name: string; published: boolean; websiteHost: string | null; country: string | null };
export type ExistingEvent = Pick<EventRecord, 'id' | 'entities' | 'type' | 'happenedOn'> & { sourceUrls: string[] }; // normalised submitted + final URLs
export type CheckContext = { page: FetchedPage; entities: Map<string, EntityInfo>; existing: ExistingEvent[]; today: string };
export type HoldReason =
  | 'unknown-entity' | 'entity-unpublished'
  | 'source-unreachable' | 'source-not-html' | 'source-not-credible'
  | 'self-published-other' | 'self-published-wording' | 'pointer-only'
  | 'quote-not-found' | 'date-not-found' | 'amount-not-in-quote'
  | 'type-unchecked' | 'type-disagreement' | 'possible-duplicate';
export type Verdict =
  | { status: 'publish'; record: EventRecord; sourceUrls: string[] }
  | { status: 'already-published'; id: string }
  | { status: 'hold'; reason: HoldReason };
export function checkCandidate(c: EventCandidate, ctx: CheckContext): Verdict;   // c is already candidateSchema-valid
```

- **Order, first failure wins:**
  1. **unknown-entity**, then **entity-unpublished:** every entity must exist and be published.
  2. **source-unreachable:** `status !== 200`. **source-not-html:** the content type doesn't contain `text/html`.
  3. **Policy on both the submitted URL and `page.finalUrl`.** **source-not-credible:** either fails `isCredibleSource({ url, title: c.source.publisher })`. **pointer-only:** either host `isHostOrSubdomain` of a pointer domain.
  4. **Self-published rule.** Find any company in the **whole entity index** whose `websiteHost` the source host (submitted or final) matches via `isHostOrSubdomain`. If that company is not `entities[0]`, hold **self-published-other**. If it is, but `summary` doesn't start with `<company name> announced` (case-insensitive), hold **self-published-wording**.
  5. **quote-not-found:** `quoteFound(c.quote, htmlToText(page.html))`. **date-not-found:** `dateFound`. **amount-not-in-quote:** applies only when funding has an amount: `amountInQuote(amount, currency, quote)`.
  6. **type-unchecked** (no `typeSecondOpinion`), **type-disagreement**.
  7. **Duplicates.** Let `urls` = the normalised submitted and final URLs. If an existing event has the same `entities[0]` and shares a URL with `urls`, return **already-published** with its id: a re-run after a crash, not a hold. Otherwise, if any existing event shares a URL, or has the same `entities[0]` and `type` with `happenedOn` within ±7 days, hold **possible-duplicate**.
- **On publish,** the record gets: `schemaVersion: 1`; `id = computeEventId(entities[0], happenedOn, type, source.url)`; `foundOn = c.foundOn ?? ctx.today`; `checks` all `true`, with `amountInQuote` per the Global Constraints, `checkerVersion: 1` and `checkedOn: ctx.today`. It must pass `eventSchema.parse`; a failure there is a bug and throws. Return `sourceUrls: urls`.

- [ ] **Step 1: Write the failing tests.** `ctx(pageOverrides?, extra?)` holds:
  - published `companies/qilimanjaro` (name `Qilimanjaro`, `websiteHost: 'qilimanjaro.tech'`)
  - published `companies/iqm` (`meetiqm.com`)
  - published `companies/kvantify` (`kvantify.com`), deliberately not in any candidate's `entities`
  - unpublished `companies/ghost`
  - a default page of `funding-release.html`, status 200, `text/html`, `finalUrl` = the submitted `https://tech.eu/2026/11/18/qilimanjaro-raises`

  `candidate(overrides?)` is a clean funding candidate for Qilimanjaro that passes. Write **one test per `HoldReason`**, each changing one thing, with expected `{ status: 'hold', reason }`. Plus:

```ts
test('clean candidate publishes a schema-valid record with foundOn = today', () => {});
test('own release, worded "<Name> announced", publishes', () => {});          // self-release.html, summary 'Qilimanjaro announced a €12M Series A'
test('own release worded "Another company announced" holds self-published-wording', () => {});
test('subdomain of own site counts as own site', () => {});                    // news.qilimanjaro.tech
test('a third company\'s site (not in entities) holds self-published-other', () => {}); // kvantify.com
test('clean URL redirecting to a pointer-only host holds pointer-only', () => {});      // finalUrl thequantuminsider.com
test('200 interstitial holds quote-not-found', () => {});                     // interstitial.html
test('client-rendered page holds quote-not-found', () => {});
test('status 204 holds source-unreachable; PDF holds source-not-html', () => {});
test('re-run of an already published candidate returns already-published', () => {});
test('URL variant of another entity\'s event holds possible-duplicate', () => {});
test('backfill foundOn is kept', () => {});
test('disclosed funding gets amountInQuote true; undisclosed and non-funding get null', () => {});
```

  Each test body sets its input and asserts the exact verdict, or the record fields named in its title.
- [ ] **Step 2: Run** `test`. Expected: FAIL.
- [ ] **Step 3: Implement** `candidate.ts` and `check.ts`.
- [ ] **Step 4: Run** `test`. Expected: PASS, every `HoldReason` member covered.
- [ ] **Step 5: Commit** `feat(events): Add candidate checker`.

### Task 5: `runCheck`, held list and CLI

**Files:**
- Create: `scripts/events/held.ts`, `scripts/events/run.ts`, `scripts/events/check-cli.ts`, `scripts/events/run.test.ts`
- Modify: `package.json` scripts (`"events:check": "tsx scripts/events/check-cli.ts"`)
- Create: `data/events-held.json` containing `[]` plus a trailing newline

**Interfaces:**
- Consumes: Task 4 (`candidateSchema`, `checkCandidate`, types), Task 2 (`eventSchema`, `eventFilePath`, `normalizeUrl`, `hostOf`, `isoDate`), `isPublished` (`source-bar.ts`).
- Produces from `held.ts`:

```ts
export type HeldRecord = {
  key: string;                  // `${entities[0]}|${normalizeUrl(sourceUrl)}`, stable across re-extractions
  entities: string[]; sourceUrl: string; reason: HoldReason;
  firstHeldOn: string; lastCheckedOn: string; attempts: number; stale: boolean;
};
export const STALE_AFTER_WEEKS = 8;
export function heldKey(entities: string[], sourceUrl: string): string;
export function isoWeek(date: string): string;   // 'YYYY-Www'
export function mergeHeld(previous: HeldRecord[], holds: Array<{ entities: string[]; sourceUrl: string; reason: HoldReason }>,
                          resolvedKeys: Set<string>, today: string): HeldRecord[];
```

  **`mergeHeld` rules:**
  - Keys in `resolvedKeys` (published or already-published this run) are removed.
  - A key in `holds` gets its reason updated and `lastCheckedOn = today`.
  - **For every remaining non-stale key (held this run or not), if `isoWeek(today) !== isoWeek(lastCheckedOn-before-update)`, then `attempts += 1` and `lastCheckedOn = today`.** So a key that wasn't resubmitted still ages once a week, and several variants of one key in a batch cost one attempt.
  - A new key starts at `attempts: 1`, `firstHeldOn = today`, and `firstHeldOn` never changes.
  - `stale = attempts >= 8`.
  - Output is sorted by key, and records contain exactly the `HeldRecord` fields: **never summary or quote.**

  Re-extraction contract (implemented in PR 5): the routine reads the non-stale keys (`entities`, `sourceUrl`) and re-extracts candidates from those URLs.
- Produces from `run.ts`:

```ts
export type RunOptions = { root: string; input: unknown; today: string; dryRun: boolean; fetchPage: (url: string) => Promise<FetchedPage> };
export type RunSummary = { published: string[]; alreadyPublished: string[]; held: Record<string, number>;
                           invalid: Array<{ index: number; error: string }>; stale: number; skippedStale: number };
export function loadEntityIndex(root: string): Map<string, EntityInfo>;  // src/content/<collection>/*.json
export function loadExistingEvents(root: string): ExistingEvent[];       // src/content/events/**/*.json, parsed with eventSchema; throws on an invalid file or duplicate id
export function runCheck(opts: RunOptions): Promise<RunSummary>;
export function fetchPageLive(url: string): Promise<FetchedPage>;        // global fetch, 20 s timeout, redirect 'follow',
                                                                         // UA 'KvantiqDirectoryEventChecker/1.0 (+https://directory.kvantiq.studio/about/)';
                                                                         // network error → { status: 0, contentType: '', html: '', finalUrl: url }
```

  **`runCheck` behaviour:**
  - **Input:** `input` must be an array, else throw. Each item goes through `candidateSchema.safeParse`; failures go to `invalid` (no held record, since there's no usable identity) and are skipped.
  - **Stale keys:** a candidate whose key is stale is skipped without fetching (`skippedStale`).
  - **Batch duplicates:** published records join `existing` immediately, so two candidates in one batch can't both publish.
  - **Writes, unless `dryRun`:**
    1. Each event file goes to `eventFilePath(record)` with **exclusive create** (`flag: 'wx'`), after `mkdir -p`. An `EEXIST` means a duplicate-id bug and throws.
    2. Then `data/events-held.json` is written **atomically**: write `data/events-held.json.tmp`, then `rename`.
    3. A crash between the two is recovered on the next run through `already-published`.
  - `loadEntityIndex` sets `websiteHost` from `hostOf(data.website)` for `companies` only, and `published` from `isPublished(data)`.
- **`check-cli.ts`:** usage `npm run events:check -- --candidates <file.json> [--today YYYY-MM-DD] [--dry-run]`.
  - `--today` defaults to today in Europe/Copenhagen and must pass `isoDate`.
  - It prints the `RunSummary` as JSON.
  - **Exit 0** when the run completes, even with holds or invalid items. **Exit 1** on unreadable or non-array input, an invalid `--today`, an invalid persisted event file or held list, or any write error.

- [ ] **Step 1: Write the failing tests** in `scripts/events/run.test.ts`. Use a temp dir (`mkdtempSync`) seeded with two company JSONs (one with 3 credible sources, one with 1), fixture pages, and a fake `fetchPage`:

```ts
test('publishes a clean candidate and writes its file', async () => {});
test('two candidates with the same URL in one batch: one published, one possible-duplicate', async () => {});
test('malformed items go to invalid, valid ones still run', async () => {});   // input [null, {}, candidate()] → invalid.length 2, published 1
test('non-array input throws', async () => {});
test('held record carries no summary or quote', async () => {
  const held = JSON.parse(readFileSync(join(root, 'data/events-held.json'), 'utf8'));
  assert.deepEqual(Object.keys(held[0]).sort(), ['attempts','entities','firstHeldOn','key','lastCheckedOn','reason','sourceUrl','stale']);
  assert.ok(!JSON.stringify(held).includes(candidate().quote));
});
test('mergeHeld: an unresubmitted key ages once per ISO week and goes stale in week 8', () => {});
test('mergeHeld: three variants of one key in one run cost one attempt', () => {});
test('mergeHeld: firstHeldOn never changes; resolved keys are removed', () => {});
test('stale key is skipped without fetching', async () => {});
test('crash recovery: event file present, held list stale → re-run returns alreadyPublished and clears the hold', async () => {});
test('existing event file with an id collision throws on write', async () => {});
test('dry run writes nothing', async () => {});
test('network failure holds as source-unreachable', async () => {});
```

  Each body sets its input and asserts the exact summary fields and files.
- [ ] **Step 2: Run** `test`. Expected: FAIL.
- [ ] **Step 3: Implement** `held.ts`, `run.ts`, `check-cli.ts` and the script.
- [ ] **Step 4: Run** `test`, then an empty dry run against the repo: `printf '[]' > "${TMPDIR:-/tmp}/empty-candidates.json"`, then `npm --prefix ~/Developer/.worktrees/events-foundation run events:check -- --candidates "${TMPDIR:-/tmp}/empty-candidates.json" --dry-run`. Expected: tests pass; the CLI prints `{"published":[],"alreadyPublished":[],"held":{},"invalid":[],"stale":0,"skippedStale":0}` and exits 0.
- [ ] **Step 5: Commit** `feat(events): Add checker CLI and held list`.

### Task 6: `/events.json` and `/event.schema.json`

**Files:**
- Create: `src/lib/events/feed.ts`, `src/lib/events/feed.test.ts`, `src/pages/events.json.ts`, `src/pages/event.schema.json.ts`

**Interfaces:**
- Consumes: `EventRecord`, `eventSchema`, `RUNTIME_ONLY_RULES` (Task 2); `isPublished` (`source-bar.ts`).
- Produces:

```ts
export type FeedEntity = { name: string; country: string | null; href: string };
export type EventsFeed = { schemaVersion: 1; count: number; entities: Record<string, FeedEntity>; events: EventRecord[] };
export type FeedEntryInput = { collection: string; slug: string; name: string; country?: string; sources?: { url: string; title?: string }[] };
export function entityHref(collection: string, slug: string): string;
export function buildEventsFeed(events: EventRecord[], entries: FeedEntryInput[]): EventsFeed;
export function eventsFeedJsonSchema(): object;
```
  - **`entityHref`:** companies → `/companies/<slug>/`, benchmarks → `/benchmarks/<slug>/`, use-cases → `/use-cases/<slug>/`, challenges → `/challenges/<slug>/`, resources → `/resources/`. PR 3 switches resources to `/resources/#<slug>` once that page has the anchors.
  - **`buildEventsFeed`:** keeps an event only if **every** entity in `entities` is a published entry. It sorts by `happenedOn` descending, then `id` ascending. `entities` holds only published keys referenced by kept events. No timestamps, so output is deterministic.
  - **`eventsFeedJsonSchema()`:** returns a JSON Schema for the **whole feed envelope**: `$id: 'https://directory.kvantiq.studio/event.schema.json'`, `$defs.EventRecord = z.toJSONSchema(eventSchema)` (minus its own `$schema`), and `events.items = { $ref: '#/$defs/EventRecord' }`. The `description` lists `RUNTIME_ONLY_RULES`.
- `events.json.ts`: an `APIRoute` `GET` returning `JSON.stringify(buildEventsFeed(...))` with `Content-Type: application/json; charset=utf-8`. `event.schema.json.ts`: an `APIRoute` returning `eventsFeedJsonSchema()`.

- [ ] **Step 1: Write the failing tests:**

```ts
test('feed: event with an unpublished primary entity is excluded', () => {});
test('feed: event with an unpublished or missing secondary entity is excluded', () => {});
test('feed: newest first, ties by id', () => {});
test('feed: entities map has only published, referenced keys', () => {});
test('feed: hrefs per collection; resources go to /resources/', () => assert.equal(entityHref('resources', 'qiskit'), '/resources/'));
test('schema: envelope schema references the EventRecord definition', () => {
  const s = eventsFeedJsonSchema() as any;
  assert.equal(s.properties.events.items.$ref, '#/$defs/EventRecord');
  assert.ok(s.$defs.EventRecord);
});
```

- [ ] **Step 2: Run** `test`. Expected: FAIL.
- [ ] **Step 3: Implement** `feed.ts` and both routes.
- [ ] **Step 4: End-to-end check through Astro.** This runs locally, and the temporary event is **never committed**.
  1. Write a valid funding event for `companies/qilimanjaro` (published on `main`) to `src/content/events/2026/e2e-tmp.json`. Build its `id` with `computeEventId`, and name the file `<id>.json`.
  2. Build with exit status kept: `npm --prefix ~/Developer/.worktrees/events-foundation run build > ~/Developer/.worktrees/events-foundation/build-debug.log 2>&1; s=$?; tail -5 ~/Developer/.worktrees/events-foundation/build-debug.log; test $s -eq 0`.
  3. Validate fresh output with `tsx`: `dist/events.json` has `count === 1`, and `eventSchema.parse(feed.events[0])` succeeds.
  4. Check `dist/event.schema.json` has `properties.events.items.$ref === '#/$defs/EventRecord'`.
  5. Negative case: `eventSchema.safeParse({ ...feed.events[0], funding: null }).success === false`.
  6. Delete the temporary file and rebuild. Expect `count === 0`.
  7. `git status --short src/content/events` shows only `.gitkeep` as new.
- [ ] **Step 5: Commit** `feat(events): Serve events feed and JSON Schema`.

### Task 7: Gate and PR

- [ ] **Step 1: Run** `npm --prefix ~/Developer/.worktrees/events-foundation run gate > ~/Developer/.worktrees/events-foundation/gate-debug.log 2>&1; s=$?; tail -20 ~/Developer/.worktrees/events-foundation/gate-debug.log; test $s -eq 0`. Expected: type-check, test and build all green.
- [ ] **Step 2: Rebase:** `git -C ~/Developer/.worktrees/events-foundation fetch origin`, then `git -C ~/Developer/.worktrees/events-foundation rebase origin/main`. Re-run the gate if anything moved.
- [ ] **Step 3: Push and open the PR.** Push with `git -C ~/Developer/.worktrees/events-foundation push -u origin feature/event-history-foundation`. Open it with `gh pr create -R de-Blanck/kvantiq-directory`, titled **`[no-visual-impact] feat(events): Add event schema, checker and JSON feed`**. The body links the spec and plan, lists the tasks, states "No UI; no events yet (backfill is PR 2)", and pastes the gate tail. **No `auto-merge` label.** Rune merges.
- [ ] **Step 4: Verify after merge:** `curl --fail -s https://directory.kvantiq.studio/events.json | head -c 120` returns `{"schemaVersion":1,"count":0`. Until it has run, report "merged but not verified".

## Handoff to later PRs

- **PR 3 (presentation):** add `id="<slug>"` anchors on `/resources/` and switch `entityHref('resources', …)` to `/resources/#<slug>`. Add the events section to both `llms.txt` and `llms-full.txt`, pointing to `/events.json` and `/event.schema.json`.
- **PR 5 (routine):** implement the re-extraction contract over non-stale held keys, and the routine-only fact-change gate (spec §2).
