# Event history PR 3: presentation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the 184 checked events to readers: an `/events/` page, a Timeline on every entry page, and an events section on `/transparency/sweeps/`.

**Architecture:** All logic lives in pure, tested functions under `src/lib/events/` (`labels.ts`, `present.ts`, `timeline.ts`, `transparency.ts`). One thin server-only loader (`load.ts`) feeds every page from the same `buildEventsFeed()` output that `/events.json` serves. `/events/` is server-rendered with a React island for filters (the `ListingView` pattern) and a vanilla Chart.js script (the `/transparency/audit/` pattern). The two talk through one DOM `CustomEvent`.

**Tech Stack:** Astro 7 (static), React islands, Tailwind tokens in `src/styles/global.css`, Chart.js v4 from the CDN, `node:test` and `assert/strict` through `npm test`.

**Spec:** `docs/superpowers/specs/2026-11-21-event-history-design.md` §5 Presentation, Acceptance criteria, Open for Rune 2. The handoff notes are in `docs/superpowers/plans/2026-11-21-event-history-pr1-foundation.md` (end) and `2026-11-22-event-history-pr2-backfill.md` (end).

**Worktree:** `~/Developer/.worktrees/events-ui`, branch `feature/events-timeline-ui`, from `origin/main` `37ddacd`. Symlink `node_modules` from the main checkout. Run the gates with `npm --prefix ~/Developer/.worktrees/events-ui …`.

## Global Constraints

- "Presentation is plain: one `/events/` page (a dated list plus one monthly chart) and a timeline on every entry page." (spec, Goals)
- One row per event: date, type badge, entity (linked), summary, source publisher (linked). Funding rows add round, amount (or "undisclosed") and lead investor. (spec §5)
- "Chart.js v4 from the CDN, as on `/transparency/audit/`": the same import URL as `audit.astro:348`. The data variable goes into `CHART_VARS`, and `/events/` goes into `ROUTES`. (spec §5)
- "Resources have no detail pages: their events appear on `/events/` and link to `/resources/#<slug>`." (spec §5)
- "Timelines show checked events, then the remaining legacy items under an 'Earlier news' heading, exactly as they render today." (spec, Open for Rune 2) **Amended by Rune on 2026-11-25:** there is no cut-off, so legacy news stays. Hide only the legacy items held as `source-unreachable` (a dead link) or `possible-duplicate` (the same news as an event already shown).
- The held list on `/transparency/sweeps/` shows "entity, source link and reason only". No held summary or quote reaches a rendered page. (spec §5)
- The Timeline stays in `DEFAULT_CARDS`, not in a collection-specific card (`CLAUDE.md:93`).
- Tokens come only from `src/styles/global.css` `@theme`: no gradients, no `shadow-glow`, badges in IBM Plex Mono 10–11px (`CLAUDE.md:33,52–68`). Copy is factual, with no marketing language (`CLAUDE.md:117`).
- Client code never imports `src/lib/events/schema.ts`, which imports `node:crypto`. It imports `labels.ts` and `present.ts` only.
- The site has a light theme only. Visual evidence means light screenshots at 1280px and 390px wide.
- The PR is **not** `[no-visual-impact]` and gets **no** `auto-merge` label. Rune merges after visual sign-off.

## Review Focus

1. **Filters that match nothing** (e.g. People plus a country). The list shows "No events match these filters." with a reset link, and the chart shows empty bars. Not a blank page. Test: `filterRows` returns `[]` (Task 1). The empty state goes in the screenshots (Task 6).
2. **Country filter on events whose entity is not a company** (`country: null`). With a country selected, these are excluded. A multi-entity event matches if any of its entities has that country. Test in Task 1.
3. **Deep links with bad parameters** (`/events/?type=bogus&country=Atlantis`). These fall back to All and no country, not to an empty list. Test: `parseFilters` (Task 1).
4. **Dates on month boundaries.** `2026-11-01` must render as "1 Nov" under "November 2026" in every timezone, never as "31 Oct". Format from the string, not via a local `Date`. Test in Task 1.
5. **An entry with no events whose legacy items are all hidden** (dead links or duplicates) must not render an empty Timeline card or tab: both hide. Test: `entryTimeline` returns `{ events: [], earlierNews: [] }` for such an entry (Task 2). Card and tab visibility use `events.length + earlierNews.length` (Task 5).

---

### Task 1: Labels and presentation helpers

**Files:**
- Create: `src/lib/events/labels.ts`, `src/lib/events/present.ts`, `src/lib/events/present.test.ts`, `src/lib/events/labels.test.ts`
- Modify: `src/lib/events/schema.ts:5-20`. Move `EVENT_TYPES`, `EventType`, `EVENT_TYPE_LABELS` and `FUNDING_ROUNDS` into `labels.ts` and re-export them from `schema.ts`, so existing imports keep working.

**Interfaces:**
- Produces, in `labels.ts` (no Node imports):
  - `EVENT_TYPES`, `EventType`, `EVENT_TYPE_LABELS`, `FUNDING_ROUNDS`, `FundingRound`
  - `FUNDING_ROUND_LABELS: Record<FundingRound, string>`
  - `EVENT_TYPE_COLORS: Record<EventType, string>` (hex, one source for both badge dots and chart datasets)
  - `HOLD_REASON_LABELS: Record<HoldReason, string>` (`import type { HoldReason } from '../../../scripts/events/check'`)
- Produces, in `present.ts`:
  - `type EventRow = { id: string; happenedOn: string; month: string; day: string; type: EventType; entities: { name: string; href: string; country: string | null }[]; summary: string; publisher: string; sourceUrl: string; funding: string | null }`
  - `toEventRow(event: EventRecord, entities: EventsFeed['entities']): EventRow` (type-only imports from `schema.ts`/`feed.ts`)
  - `fundingLine(f: { amount: number | null; currency: string | null; round: FundingRound; investors: string[] }): string`
  - `monthHeading(date: string): string`, `dayLabel(date: string): string`
  - `type Filters = { type: EventType | 'all'; country: string; q: string }`
  - `parseFilters(search: string, countries: string[]): Filters`, `filterRows(rows: EventRow[], f: Filters): EventRow[]`, `countryOptions(rows: EventRow[]): string[]`
  - `monthlyCounts(rows: EventRow[], endMonth: string, months?: number): { labels: string[]; series: Record<EventType, number[]> }` (default 24 months)

- [ ] **Step 1: Write the failing tests** (`present.test.ts`, `labels.test.ts`)

```ts
test('fundingLine', () => {
  assert.equal(fundingLine({ amount: 12_000_000, currency: 'EUR', round: 'series-a', investors: ['Kibo Ventures', 'X'] }), 'Series A, €12.0M · Kibo Ventures');
  assert.equal(fundingLine({ amount: 1_500_000_000, currency: 'USD', round: 'ipo', investors: [] }), 'IPO, $1.5B');
  assert.equal(fundingLine({ amount: 250_000, currency: 'DKK', round: 'grant', investors: [] }), 'Grant, DKK 250,000');
  assert.equal(fundingLine({ amount: null, currency: null, round: 'seed', investors: [] }), 'Seed, undisclosed');
});
test('dates format from the string, not local time', () => {
  assert.equal(dayLabel('2026-11-01'), '1 Nov');
  assert.equal(monthHeading('2026-11-01'), 'November 2026');
});
test('parseFilters falls back on unknown values', () => {
  assert.deepEqual(parseFilters('?type=bogus&country=Atlantis&q=iqm', ['Finland']), { type: 'all', country: '', q: 'iqm' });
  assert.deepEqual(parseFilters('?type=funding&country=Finland', ['Finland']), { type: 'funding', country: 'Finland', q: '' });
});
test('filterRows: type, country (any entity), search, empty result', () => { /* rows: a funding event for a Finnish company, a product event for a benchmark (country null), and a partnership with two entities, one German */
  // type=funding → only the funding row; country=Germany → the two-entity row only; country set → the benchmark row excluded;
  // q matches summary, entity name, publisher, case-insensitive; type=people → []
});
test('monthlyCounts: 24 labels ending at endMonth, events outside the window ignored', () => {
  const { labels, series } = monthlyCounts(rows, '2026-11');
  assert.equal(labels.length, 24); assert.equal(labels[0], 'Dec 2024'); assert.equal(labels[23], 'Nov 2026');
  assert.equal(series.funding.reduce((a, b) => a + b, 0), /* funding rows inside the window */ 1);
});
test('every hold reason and funding round has a label', () => { /* iterate HOLD_REASONS (scripts/events/check.ts) and FUNDING_ROUNDS */ });
test('toEventRow resolves entity names and hrefs from the feed and fills funding only for funding events', () => {});
```

- [ ] **Step 2:** `npm --prefix ~/Developer/.worktrees/events-ui test`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement `labels.ts` and `present.ts`.**
  - **Round labels:** Pre-seed, Seed, Series A, Series B, Series C+, Grant, Debt, IPO, Undisclosed round, Other.
  - **Amounts:** ≥1e9 gives one decimal plus "B"; ≥1e6 gives one decimal plus "M"; anything smaller is printed in full with `en-GB` grouping. EUR, USD and GBP print as € $ £; any other currency prints as `"<ISO> "`. A null amount prints as "undisclosed".
  - **Hold reasons:** one plain label per code, e.g. `pointer-only` → "Aggregator link, original source not yet found", `homepage-url` → "Links to a homepage, not an article", `not-extracted` → "Not yet read".
  - **Search** covers summary, entity names, publisher and the funding line.
- [ ] **Step 4:** Run `npm test` and type-check. Expected: PASS, 0 errors.
- [ ] **Step 5: Commit:** `feat(events): Add event labels and presentation helpers`.

### Task 2: Timeline data and shared loader

**Files:**
- Create: `src/lib/events/timeline.ts`, `src/lib/events/timeline.test.ts`, `src/lib/events/load.ts`
- Modify:
  - `src/lib/events/feed.ts:9-11` (resources → `/resources/#<slug>`) and its test
  - `src/pages/events.json.ts` (use `loadEventsFeed()`)
  - `docs/superpowers/specs/2026-11-21-event-history-design.md` "Open for Rune" item 2: append "**Amended (Rune, 2026-11-25): no cut-off.** Legacy news stays visible under 'Earlier news' as not yet checked. Only items held as `source-unreachable` or `possible-duplicate` are hidden. Reason: re-extraction (PR 5) is not built, and a cut-off would remove unchecked news before it could be checked."

**Interfaces:**
- Consumes: `buildMatcher` and `loadAliases` from `scripts/backfill/match.ts`; `MatchResult` from `scripts/backfill/types.ts`; `readHeldList` from `scripts/events/run.ts`; `toEventRow` and `EventRow` from Task 1.
- Produces, in `timeline.ts`:
  - `type LegacyNews = { title: string; excerpt?: string; url: string; source: string; date: string }`
  - `HIDDEN_LEGACY_REASONS = ['source-unreachable', 'possible-duplicate'] as const`
  - `type Timeline = { events: EventRecord[]; earlierNews: LegacyNews[] }`
  - `entryTimeline(key: string, events: EventRecord[], news: LegacyNews[], match: (entity: string, url: string) => MatchResult): Timeline`
- Produces, in `load.ts` (server-only, untested glue, since `astro:content` cannot run under `node:test`):
  - `loadEventsFeed(): Promise<EventsFeed>` (the body of today's `events.json.ts`)
  - `loadEntryIndex(): Promise<Record<string, { name: string; href: string }>>` (every entry, published or not)
  - `entryTimelineProps(key: string, news: LegacyNews[]): Promise<{ events: EventRow[]; earlierNews: LegacyNews[] }>`

- [ ] **Step 1: Write the failing tests** (`timeline.test.ts`; extend the feed test)

```ts
test('events for the entry only, newest first, ties by id', () => {});
test('legacy items matched to an event are dropped; held (pointer-only etc.) and unmatched stay, in file order', () => {});
test('legacy items held as source-unreachable or possible-duplicate are hidden', () => {});
test('an entry whose legacy items are all hidden and has no events gets an empty timeline', () => {
  assert.deepEqual(entryTimeline(key, [], [deadLink, duplicate], match), { events: [], earlierNews: [] });
});
test('entityHref links resources to their anchor', () => {
  assert.equal(entityHref('resources', 'qiskit'), '/resources/#qiskit');
});
```

- [ ] **Step 2:** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement, and amend the spec.** Comment `HIDDEN_LEGACY_REASONS` with the 2026-11-25 amendment. Before committing, log how many legacy items each collection hides, and record that count in the PR body.
- [ ] **Step 4: Prove `/events.json` changed only where intended.** Build `main` and the branch, then diff the two `dist/events.json` files. Expected: only `href` values for resources differ.
- [ ] **Step 5: Commit:** `feat(events): Add entry timelines and resource anchors`.

### Task 3: Transparency events section

**Files:**
- Create: `src/lib/events/transparency.ts`, `src/lib/events/transparency.test.ts`
- Modify: `src/pages/transparency/sweeps.astro` (new section after the header stats, before the run list); `scripts/check-transparency-data.mjs` (fail when `data/events-held.json` is missing or fails `heldListSchema`; an empty array is valid)

**Interfaces:**
- Consumes: Task 1 `HOLD_REASON_LABELS`; Task 2 `loadEventsFeed`, `loadEntryIndex`; `readHeldList` and `HeldRecord` from `scripts/events/`.
- Produces:
  - `eventsSummary(publishedCount: number, held: HeldRecord[]): { published: number; held: number; stale: number; byReason: { reason: string; label: string; count: number }[] }` (sorted by count desc, then reason)
  - `type HeldRow = { entity: string; href: string | null; sourceUrl: string; sourceHost: string; reason: string; reasonLabel: string }`
  - `heldRows(held: readonly HeldRecord[], index: Record<string, { name: string; href: string }>): HeldRow[]` (sorted by entity, then host; an unknown entity shows its key with `href: null`)

- [ ] **Step 1: Write the failing tests**

```ts
test('heldRows never carries text beyond entity, source and reason', () => {
  const leaky = { ...heldRecord, summary: 'SECRET SUMMARY', quote: 'SECRET QUOTE' } as HeldRecord;
  const out = JSON.stringify(heldRows([leaky], index));
  assert.ok(!out.includes('SECRET SUMMARY') && !out.includes('SECRET QUOTE'));
  assert.deepEqual(Object.keys(heldRows([leaky], index)[0]).sort(), ['entity', 'href', 'reason', 'reasonLabel', 'sourceHost', 'sourceUrl']);
});
test('eventsSummary counts held by reason and stale', () => {});
```

- [ ] **Step 2:** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement the helpers and the section.**
  - The section opens with three stats in the page's existing stat-grid style: Published, Held, Stale.
  - Below them, a "Held by reason" list of label plus count.
  - Below that, a collapsed `<details>` titled "Held candidates (N)". It holds a table with the columns Entity (linked when `href`), Source (host text, links to `sourceUrl`, `rel="nofollow noopener"`) and Reason.
  - Add one plain sentence saying held candidates are not published, and are re-checked weekly until 8 weeks have passed.
- [ ] **Step 4: Check the rendered page.**
  - Run `npm test` and the build.
  - Then `grep -c 'SECRET' dist/transparency/sweeps/index.html` returns `0` (a sanity check).
  - Count `<tr>` inside the held table. Expected: 441.
- [ ] **Step 5: Commit:** `feat(transparency): Show event counts and held list`.

### Task 4: `/events/` page

The implementer loads the `dataviz` skill before writing chart code.

**Files:**
- Create: `src/components/EventsView.tsx`, `src/pages/events/index.astro`
- Modify:
  - `src/components/Header.astro:2-10`: add `{ href: '/events/', label: 'Events' }` after Resources
  - `scripts/verify-live.mjs:44-57,95`: add `/events/` to `ROUTES` and `'eventsChartData'` to `CHART_VARS`
  - `scripts/verify-live.test.ts:88-89`
  - `src/pages/llms.txt.ts`, `src/pages/llms-full.txt.ts`: add an Events section (what an event is, the six types, the count, and links to `/events/`, `/events.json` and `/event.schema.json`)

**Interfaces:**
- Consumes: Task 1 `EventRow`, `toEventRow`, `parseFilters`, `filterRows`, `countryOptions`, `monthlyCounts`, `EVENT_TYPE_LABELS`, `EVENT_TYPE_COLORS`; Task 2 `loadEventsFeed`.
- Produces:
  - `EventsView({ rows: EventRow[]; countries: string[] })`
  - The DOM contract: `window.dispatchEvent(new CustomEvent('events:filter', { detail: { type: EventType | 'all' } }))`, fired on mount and on every type change.

- [ ] **Step 1: Write the failing test.** `verify-live.test.ts` asserts that `CHART_VARS` includes `eventsChartData` and `ROUTES` includes `/events/`. Run it and see FAIL.
- [ ] **Step 2: Build the page.** Use `BaseLayout` with a factual title and description.
  - **Header:** "Events", then "`{count}` events · `{entities}` entries" (counts from the feed).
  - **Chart:** a `<canvas role="img" aria-label="Events per month for the last 24 months, stacked by type">`. Pass `eventsChartData = monthlyCounts(rows, <build month>)` through `<script define:vars>`. The chart is a stacked bar using `EVENT_TYPE_COLORS`, and it listens for `events:filter` to show only the selected type (all six for All).
  - **Island:** `<EventsView client:load …/>`. It holds the type chips (All plus six, as `aria-pressed` buttons), a country `<select>`, a search input, and URL state with the keys `type`, `country` and `q` (via `history.replaceState`).
  - **List:** grouped under `monthHeading`. Each row shows `day`, the type badge (mono, coloured dot), the linked entities, the summary, the funding line when present, and "source: `<publisher>`" linking to `sourceUrl` in a new tab. The empty state follows Review Focus 1.
- [ ] **Step 3:** Run `npm test` and the build. Check that `dist/events/index.html` contains `eventsChartData = {` and 184 rows. Check that `?type=funding` in a browser shows 38 rows, each with a funding line.
- [ ] **Step 4: Commit:** `feat(events): Add events page with filters and monthly chart`.

### Task 5: Timeline on entry pages and resource anchors

**Files:**
- Modify:
  - `src/components/DetailPage.tsx:90-111,139,159-172,289-293`
  - `src/components/DetailTabs.tsx:29,74-78,126-155`
  - `src/pages/{companies,benchmarks,use-cases,challenges}/[slug].astro` (the `news=` prop)
  - `src/components/DataTable.tsx`, `src/components/CardGrid.tsx`: an optional `anchorId` renders as `id` plus `scroll-mt-24` on the row or card
  - `src/pages/resources/index.astro`: pass `anchorId: r.data.slug`

**Interfaces:**
- Consumes: Task 2 `entryTimelineProps`; Task 1 `EventRow`, `EVENT_TYPE_LABELS`, `EVENT_TYPE_COLORS`.
- Produces: the `DetailPage` prop `timeline: { events: EventRow[]; earlierNews: LegacyNews[] }` replaces `news`. The tab id `'news'` becomes `'timeline'`. No storage or hash depends on the old id (checked: none).

- [ ] **Step 1: Make the change.**
  - The `DEFAULT_CARDS` entry becomes `{ id: 'timeline', label: 'Timeline' }`.
  - The card shows the first 3 of (events, then earlier news), in the existing `NewsDashboardList` row style. An event row shows day plus year, the type badge, the summary and the publisher ↗.
  - **Tab:**
    - The eyebrow becomes "`{n}` checked events, newest first".
    - Event cards use the existing card style, with the funding line when present, and link to the source.
    - If any earlier news remains, an `h-sm` heading "Earlier news" follows, then the legacy cards rendered exactly as today.
    - The legacy eyebrow becomes "`{m}` items not yet checked".
    - Card and tab are visible when `events.length + earlierNews.length > 0`.
  - Each `[slug].astro` passes `timeline={await entryTimelineProps('<collection>/' + slug, x.news ?? [])}`.
- [ ] **Step 2:** Run `npm test`, type-check and the build.
  - `dist/companies/iqm/index.html` contains "Timeline" and no "Latest News".
  - `grep -L 'Latest News' dist/{companies,benchmarks,use-cases,challenges}/*/index.html | wc -l` equals the number of detail pages.
  - `dist/resources/index.html` contains `id="<slug>"` for every resource that has events.
- [ ] **Step 3: Commit:** `feat(events): Replace news with a timeline on entry pages`.

### Task 6: Visual evidence, review, PR

- [ ] **Step 1: Rebase and run the gate.** `git -C ~/Developer/.worktrees/events-ui fetch origin`, then `rebase origin/main`, then `npm --prefix ~/Developer/.worktrees/events-ui run gate > gate.log 2>&1`, then `tail -20 gate.log`. Expected: green.
- [ ] **Step 2: Take screenshots** of a local `astro preview` with `"/Users/runehojgaarddeblanck/Developer/Kvantiq Studio Platform/platform/node_modules/.bin/playwright" screenshot --full-page`, at 1280px and 390px. Save them to `.visual-signoff/events-ui/`:
  - `/events/`
  - `/events/?type=funding`
  - the empty state
  - a company Timeline card and tab with earlier news (IQM)
  - a benchmark with events
  - `/resources/#<slug>` scrolled to the anchor
  - the sweeps events section with `<details>` open
  - the header nav

  Open every image before claiming it shows the change.
- [ ] **Step 3: Get the Codex review.** Codex reviews the whole diff read-only against the spec and this plan, looping until READY. Codex pushback is signal: examine it before reverting anything.
- [ ] **Step 4: Open the PR.**
  - Push from the main checkout. Remove the `node_modules` symlink before `git add`.
  - `gh pr create -R de-Blanck/kvantiq-directory`, titled **`feat(events): Add events page and entry timelines`**.
  - The body links the spec and the plan, lists the tasks, embeds the screenshots, states the number of hidden legacy items and the 5 Review Focus results, and pastes the gate tail.
  - No `auto-merge` label. **Stop for Rune's visual sign-off.**
- [ ] **Step 5: After Rune merges.** Confirm with the Vercel API that the merge SHA is READY in production. Then run `npm run verify:live` (13 routes) and one check of `curl -s https://directory.kvantiq.studio/events/ | grep -c 'eventsChartData'`. Update `STATUS.md`: PR 3 done, legacy news kept with no cut-off, next PR 4. Until verified, report "merged but not verified".

## Decisions for Rune to check

- **The `/events/` filters run over the server-rendered feed (island props), not a client `fetch('/events.json')`.** The data is the same `buildEventsFeed()` output. The list then works without JavaScript, gets indexed, and `verify:live` hashes real rows rather than an empty shell.
- **Decided (Rune, 2026-11-25): legacy news stays, with no cut-off.** Only dead links and duplicates of a shown event are hidden. Task 2 records this in the spec.
- **"Events" is added to the main nav** after Resources. Without it, the page is reachable only from the sitemap and `llms.txt`.
- **The held list (441 rows) sits in a collapsed `<details>`** on `/transparency/sweeps/`, so the sweep log stays the page's main content.
