# Event history — design

**Date:** 2026-11-21 · **Status:** draft, awaiting Rune's approval · **Repo:** `de-Blanck/kvantiq-directory`

Project 1 of 4 in making the Directory more valuable:
1. **Event history** (this doc)
2. Free agent access: MCP server, JSON/Atom feeds
3. Accounts, paywall, alerts, billing
4. Scored challenge results and the Atlas relationship graph

## Intent

Today the Directory records *what is true now* about each entry. It does not record *what changed and when*. News items are appended (PR #86 stopped the sweep destroying them), but they are untyped headlines, so nobody can ask "show me every funding round in DACH this quarter". Facts like funding or headcount are overwritten in place, and the old value survives only in git history, which neither the site nor an agent can read (`.vercelignore` excludes `.git`).

The change history is the valuable part. It is what a paid tier will gate (project 3), what agents will query (project 2), and what the Atlas will link into its graph (project 4). This project turns every news item and every fact change into a **typed, dated, sourced, append-only event record**, keeps that record flowing **without weekly human review**, and shows it in the plainest way possible.

## Goals

- Every news item and every change to a tracked fact becomes an event: who, what type, when it happened, when we found it, a one-line summary, the source and a verbatim quote from it.
- Events are filterable by type (funding rounds in particular, with amount, currency and round), by entity and by country, and are structured so alerts can be built on them later.
- The pipeline runs every week with no human in the loop. Anything that fails a check is held back, not published and not deleted.
- Presentation is plain: one `/events/` page (a dated list plus one monthly chart) and a timeline on every entry page.
- Decisions made now keep projects 2–4 cheap (see [Future-proofing](#future-proofing)).

## Non-goals

- Alert delivery, accounts, paywall, billing (project 3).
- MCP server, Atom/RSS feeds (project 2). `/events.json` ships here only because the page needs it.
- Linking events into the Atlas (project 4).
- Discovering new companies. The refresh still updates existing entries only.
- Faster than weekly cadence.
- Rebuilding `/transparency/intelligence/`. It can later reuse events; not in scope.

## Anti-goals (failure even if it technically works)

- An unverified claim is visible anywhere on the site, the held list included.
- Any existing news item is lost: the 473 the site parses, plus at least 3 hidden by duplicate `news` keys (`resources/qiskit.json` has three, `resources/xprize-quantum-applications.json` two; a JSON parser keeps only the last).
- The paid product of project 3 ends up as repackaged headlines from The Quantum Insider, which sells quantum market intelligence itself.
- The pipeline needs Rune every week.
- A third pile of unmerged refresh PRs. (The first, 17 PRs, was consolidated in #85 on 2026-09-01. The second, #141–#164, is open now.)

## Constraints

- Static Astro 7 site, content collections validated by Zod v4 (`astro/zod`). No server, no database.
- Nothing in the Vercel build may depend on git history.
- Content is CC BY 4.0 (`LICENSE-DATA`). Quotes copied from sources are third-party text and must be excluded from that licence.
- The existing integrity rules stay in force: an entry needs ≥3 credible sources to be published (`src/lib/source-bar.ts`), and "credible" is decided only by `isBlocklistedSource` (`scripts/ai-sweep.mjs:101`).
- The weekly refresh is the cloud routine **"Kvantiq Directory Weekly Refresh"** (`trig_01Rg7ULzb3yo8ydZ6FxtUqae`, Sundays 23:59 Europe/Copenhagen, Opus 5.5). Its instructions live in the routine's settings, not in the repo.
- Rune cannot do weekly reviews.
- `main` is **unprotected**: no branch protection and no rulesets (`gh api …/branches/main/protection` returns 404). Routine PRs are authored as `de-Blanck`, so the routine has owner rights. `NEVER_AUTOMERGE` (`scripts/auto-merge.mjs:34-43`) binds only the local auto-merge job, not the routine.
- GitHub Actions run again (the repo is public; Dependabot runs succeeded 2026-11-14), despite `auto-merge.mjs:5` and `docs/cloud-agent-migration.md` saying otherwise. **Rune's decision (2026-11-21): do not use GitHub Actions for this project.**
- Codex has never reviewed a PR on GitHub in Rune's repos. Today it is used only through the local `codex` CLI (0.167.0).
- Resources have no detail pages (`CLAUDE.md:86`), only `/resources/`.
- The routine hit its web-search quota on 20 Nov (issue #165). Backfill research must be spread out, not done in one run.

## Approaches considered

| | Approach | Trade-off | Verdict |
|---|---|---|---|
| **A** | Events as files in a new `events` content collection, checked by a deterministic script, merged by the routine itself | No new infrastructure, full git audit trail, `verify:live` keeps working. Fresh events are public until project 3; filtering happens in the browser (fine at hundreds of events). | **Chosen by Rune** |
| B | Events in a Supabase table from day one | Ready for paywall, alerts and MCP with no later move. Adds a database, secrets and a second deploy path for features not needed yet, and loses the git audit trail. | Rejected: too much too early |
| C | Add `type` and fields to the existing `news` items inside each entry | Smallest change. Fresh events could not be embargoed separately later, and fact changes have no home. | Dropped: breaks project 3 |

## Design

### 1. The event record

A new content collection `events`: one JSON file per event at `src/content/events/<YYYY>/<id>.json`, where `<YYYY>` is the year it happened. The Zod schema lives in `src/content.config.ts` beside the others.

```jsonc
{
  "schemaVersion": 1,
  "id": "iqm-2026-07-08-partnership-3f9a2c",     // permanent, never renamed
  "entities": ["companies/iqm"],                  // collection/slug; first is primary
  "type": "partnership",
  "subtype": null,                                // corporate only: acquisition | merger | listing | closure
  "happenedOn": "2026-07-08",
  "foundOn": "2026-07-12",                        // first recorded by us; immutable
  "summary": "LUMI AI Factory selects IQM to deliver a 150-qubit system for Kajaani",
  "source": { "url": "https://lumi-supercomputer.eu/…", "publisher": "LUMI", "publishedOn": "2026-07-08" },
  "pointers": [],                                 // secondary coverage, e.g. aggregator articles; never the evidence
  "quote": "The LUMI AI Factory has selected IQM Quantum Computers to deliver…",
  "funding": null,                                // required object when type = funding
  "change": null,                                 // { field, from, to } for fact-change events
  "origin": "refresh",                            // refresh | backfill | manual | fact-diff
  "checks": {
    "checkerVersion": 1, "checkedOn": "2026-11-23",
    "sourceLive": true, "sourceCredible": true, "notPointerOnly": true,
    "quoteFound": true, "dateFound": true, "amountInQuote": null, "typeAgreed": true
  }
}
```

- **Types (six):** `funding` · `partnership` (partnerships and contracts) · `product` (products and milestones) · `people` · `corporate` (mergers, IPO, closure) · `other`. Labels live in one file so a type is a one-line addition.
- **`funding`:** `{ amount: number | null, currency: ISO-4217 | null, round: pre-seed | seed | series-a | series-b | series-c-plus | grant | debt | ipo | undisclosed | other, investors: string[] }`. `amount: null` means undisclosed.
- **`id`:** `<primary-slug>-<happenedOn>-<type>-<first 6 hex of sha256(source.url)>`. Corrections edit fields; the id never changes.
- **`summary`:** our words, factual, ≤140 characters. **`quote`:** verbatim from the source, one sentence, ≤300 characters.
- **Published = every applicable check is `true`.** The schema enforces this, so an unchecked event fails the build rather than slipping onto the page.

### 2. The checker (deterministic, no AI)

`scripts/events/check.ts`, run as `npm run events:check`. It takes candidate events (written by the routine or the backfill) and sorts each into **publish** (written as an event file) or **hold** (written to `data/events-held.json`). In order:

1. **Entity:** every `entities[]` value exists and its entry is published.
2. **Source live:** GET returns 200. A bot block or paywall is held as `source-unreachable`, not failed silently.
3. **Source credible:** `isCredibleSource` from `src/lib/source-bar.ts`, so there is still one definition of credible. A company's own site or press release is accepted only for events whose primary entity is that company, worded "<Entity> announced …" (Open for Rune #1).
4. **Not pointer-only:** the source domain is not on the pointer-only list (`src/lib/events/pointer-domains.ts`, starting with `thequantuminsider.com` and `quantumcomputingreport.com`). These may appear in `pointers` but never as the evidence. Outlets with their own reporting (HPCwire, Sifted, tech.eu, EU-Startups) count as sources. *(Claude's call; tune the list in that one file.)*
5. **Quote found:** the quote appears in the page's visible text after normalising whitespace, case, Unicode quotes and dashes.
6. **Date found:** `happenedOn` matches the page's published-date metadata (`article:published_time`, JSON-LD `datePublished`) within ±3 days, or appears in the page text in a common format.
7. **Amount in quote** (funding with an amount): the number appears in the quote, normalising `€12M` / `EUR 12 million` / `12.0m`.
8. **Type agreed:** the candidate carries `typeSecondOpinion`, produced by a separate AI pass that saw only the quote and summary. It must equal `type`. This is the only AI-dependent check, and it guards the type, nothing else.
9. **Not a duplicate:** no existing event has the same `source.url`, and none has the same primary entity and type with `happenedOn` within ±7 days. A suspected duplicate is held as `possible-duplicate`, not dropped.

The checker also enforces **fact-change events, for routine PRs only** (branch `chore/auto-refresh-*`). When git is available (in the routine, locally, in the gate; not on Vercel), it diffs tracked fields in each entry against `origin/main`. Every value the routine changes needs a matching event with `change: {field, from, to}`, and that event passes **the same checks as any other event**: source, quote, date. If the evidence is missing, the scalar update is not applied and the candidate is held. Tracked fields: companies `funding`, `employees`, `headquarters`, `products`, `accessModel`; resources `lastUpdated`, `maturity`; challenges `registrationDeadline`, `prizes`. Without git, the check prints a skip notice; it never passes silently.

**Human content PRs are exempt** from the fact-change requirement. New entries (e.g. #167) and corrections of our own mistakes (e.g. #166) are not things that "happened", so they create no events. An editor who records a real-world change can add an event by hand (`origin: "manual"`, same checks), helped by `npm run events:from-diff`. *(Claude's call.)*

**Held list** (`data/events-held.json`): `{ candidateId, entities, sourceUrl, reason, firstHeldOn, attempts }`. **It never stores the summary or quote.** Each run retries held candidates. After 8 failed attempts a candidate is marked `stale` and no longer retried, but it is kept.

**Tests:** `scripts/events/check.test.ts` on `node:test`, against saved HTML pages in `scripts/events/fixtures/`. No network in tests. One fixture per hold reason, plus a clean pass.

### 3. The weekly routine

- **Move the routine's instructions into the repo** at `scheduler/weekly-refresh.md`. The routine's own prompt shrinks to "read and follow `scheduler/weekly-refresh.md`". Changes then go through PRs and history.
- **Self-merge guard:** the routine may merge its own PR only when the diff touches nothing outside `src/content/**`, `data/events-held.json` and `data/generated/sweep-runs.json`. Any other path (including `package-lock.json`, which #150 and #160 changed) means the PR stays open and the heartbeat says why. How that guard is enforced is in [Open for Rune](#open-for-rune).
- **First step of PR 5:** a manual dry run of the routine proves that, in its cloud environment, Node can fetch arbitrary sites and `gh pr merge` works. If Node fetch is blocked, every candidate would be held as `source-unreachable`. In that case the environment's network setting needs widening (Rune's account), and the builder stops and reports rather than working around it.
- **Run log:** each run appends a record to `data/generated/sweep-runs.json` in the existing shape, so `/transparency/sweeps/` keeps a live log after the local sweep is retired. `DetailTabs.tsx:132` ("Updated weekly via AI sweep") is updated to match.
- **New flow:** handle last week's PR if still open (below) → research (as today) → write candidates → second-opinion pass for type (a subagent given only quote and summary) → `npm run events:check` → apply passing events, source additions and scalar updates with their change events → `npm run gate` → open the PR → **request a Codex review** → merge when all three conditions hold (below) → wait for the deploy → `npm run verify:live` → heartbeat issue.
- **Merge conditions:** (1) `npm run gate` is green; (2) the diff touches only allowed paths; (3) **Codex has reviewed the PR and raised no blocking issue.** Codex is a different model, so its read is independent of the Claude routine that wrote the PR. The routine requests the review through Codex's GitHub integration (an `@codex review` comment) and waits up to 30 minutes. If any condition fails, the PR stays open and the heartbeat says which one.
- **Last week's PR:** each run starts by re-checking any refresh PR still open from an earlier run. If the three conditions now hold (say, Codex replied after the 30-minute wait), it merges that PR first. Otherwise it reports it. Together with the 8-day flag, nothing piles up silently.
- **The routine never resolves Codex's review threads itself.** Only Rune does.
- **The routine stops appending to `news` arrays.** From the first run after the backfill, events are the record.
- **Heartbeat issue** adds counts published, held by reason, and stale. It also flags any refresh PR open longer than 8 days, so a pile-up is visible in week two, not month three.
- If the gate fails, the routine does not merge. It leaves the PR open and says so in the heartbeat (today's behaviour).

### 4. One-time backfill

1. **Harvest the stuck PRs.** A script reads the diff of each open `chore/auto-refresh-*` branch against `main` (#141–#164, plus whatever the 22 Nov run adds), turns their news items into candidates and their scalar updates into change candidates, and validates their new source URLs. Everything goes through the checker. The PRs are then closed with a comment linking the backfill PR. The `ai-sweep/weekly-2026-09-27` PR (#147) is closed too (see §6).
2. **Convert the 473 existing news items.** An extraction pass fetches each source, picks the quote, writes the summary, assigns a type (plus the second opinion), and fills funding fields. For the 43 items whose URL is a homepage, it first searches for the specific article. `origin: "backfill"`. `foundOn` = the date the item's URL first entered `main` (from git history, available at backfill time), falling back to `happenedOn`.
3. **Repair duplicate keys first.** Merge the duplicate `news` arrays in `qiskit.json` and `xprize-quantum-applications.json` into one array each, deduped by URL, before anything parses them.
4. **Reconcile.** The script finds legacy items by scanning the raw files, not parsed JSON, and prints every legacy URL as *event*, *held (reason)* or *missing*. **Missing must be 0** before merge.
5. **Legacy `news` arrays stay in the files.** Nothing is deleted. Whether unconverted legacy items stay *visible* is in [Open for Rune](#open-for-rune). Note: 173 of 473 legacy items (37%) cite the proposed pointer-only sites (TQI 143, QCR 30) and 6 cite blocklisted ones. They will be held unless the backfill finds a primary source for them.
6. Land the backfill in one PR per collection. The PR body lists 20 randomly sampled events with their quotes, for a one-off spot-check by Rune. That is the only human review in this project.

### 5. Presentation

**`/events/` page.** Text sketch (Claude's proposal; final look gets Rune's visual sign-off on the PR):

```
Events                                             473 events · 117 companies
[All] [Funding] [Partnerships] [Products] [People] [Corporate] [Other]   Country ▾   Search…

▂▃▅▃▂▆▅▃▂▁▂▃   events per month, last 24 months, stacked by type

November 2026
  20 Nov   FUNDING    Qilimanjaro · Series A, €12.0M · Kibo Ventures     source: qilimanjaro.tech
  18 Nov   PRODUCT    IQM · Halocene H4 delivered to Kajaani             source: meetiqm.com
October 2026
  …
```

- One row per event: date, type badge, entity (linked), summary, and the source publisher (linked). Funding rows add round, amount and lead investor.
- Filters are client-side over `/events.json`, a build-time `APIRoute` returning every published event. The chart follows the type filter.
- Chart.js v4 from the CDN, as on `/transparency/audit/`. Its data variable is added to `CHART_VARS` (`scripts/verify-live.mjs:95`), and `/events/` is added to `ROUTES`.

**Entity pages.** The existing news card and news tab (`DEFAULT_CARDS`, `DetailTabs.tsx`) become **Timeline**, showing that entry's events newest first (legacy items: see [Open for Rune](#open-for-rune)). It applies to every collection with detail pages, so it stays in `DEFAULT_CARDS` without breaking the "no collection-specific cards" rule. **Resources have no detail pages:** their events appear on `/events/` and link to `/resources/#<slug>`. *(Claude's call.)*

**Transparency.** `/transparency/sweeps/` gains an events section: counts published, held by reason, and stale, plus the held list showing **entity, source link and reason only**. A test asserts that no held summary or quote text reaches the rendered page.

**`llms.txt` / `llms-full.txt`** gain an events section and point to `/events.json` and `/event.schema.json`.

### 6. Pipeline clean-up

- **Retire the local Sunday sweep.** The launchd job `com.kvantiq.directory.weekly` has exited every week since 27 Sep, because its own open PR #147 makes it think "another machine already ran". The cloud routine does the same job. Remove the launchd job, `scripts/scheduled-run.mjs`, the sweep worktree, and whatever only it uses (`weekly-agent.ts`, the sweep half of `ai-sweep.mjs`). **First move `isBlocklistedSource` and its domain list into `src/lib/`**: `source-bar.ts` imports it from `ai-sweep.mjs` today.
- **Leave the local auto-merge job alone** for Dependabot, but out of the events path. It is currently jammed: Rune's main Directory checkout has two uncommitted deletions (`docs/superpowers/plans/2026-05-08-directory-hardening-pass.md`, `src/lib/jsonld/event.test.ts`), and the job refuses a dirty tree. Those deletions are Rune's to keep or discard. Record this in `STATUS.md`.

### 7. Rulebook changes (Rune's explicit sign-off; never auto-merged)

In the Directory's `CLAUDE.md`:
- **Autonomy tiers**, as drafted on 2026-09-06 (`STATUS.md` "What's next"), with Tier 2 explicitly covering "events and source additions that pass `npm run events:check`, merged by the refresh routine".
- **"How events work"**: the schema, the checks, how to add a manual event, how to correct one (edit fields, never the id), and that `news` arrays are frozen.
- Boy Scout: `CLAUDE.md:12` still says Astro 6.

In `LICENSE-DATA`: quotes in `src/content/events/**` are third-party text, excluded from CC BY.

## Future-proofing

| Decision now | What it saves later |
|---|---|
| One schema, served as `/event.schema.json` via `z.toJSONSchema()` from an `APIRoute` (no generated file to drift) | Project 2's MCP server and project 3's table use the same definition |
| `foundOn` separate from `happenedOn` | Project 3's 30-day embargo and alerts key off `foundOn` |
| Permanent `id` | Alerts, MCP, paywall and Atlas all reference the same event |
| `/events.json` at build | Project 2 starts with a working feed |
| `entities` use `collection/slug`, as the Atlas importer's `sourceRef` does | Project 4 links events into the graph without mapping |
| `entities` is an array | Partnerships between two Directory entries become graph edges |
| `checks` stored on every event | The "how we know" shown to paying users and agents |
| One file per event | Project 3 can withhold fresh events by moving files, without restructuring |
| Routine instructions in the repo | Future pipeline changes are reviewed PRs, not edits in a settings screen |

## Suggested PR breakdown

Each PR passes `npm run gate` on its own.

1. Schema, checker, fixtures and tests, `/events.json`, `/event.schema.json`, and the `isBlocklistedSource` move. `[no-visual-impact]`
2. Backfill: harvest the stuck PRs, convert legacy news, reconciliation output. Close the PRs. One data PR per collection.
3. `/events/` page, Timeline card and tab, transparency section. **Visual sign-off.**
4. Rulebook PR (Directory `CLAUDE.md`, `LICENSE-DATA`). Rune approves.
5. `scheduler/weekly-refresh.md`, then update the routine to point at it, self-merge with the Codex review, heartbeat additions, fact-change check in the gate. **Before PR 5:** Rune connects Codex to the repo and enables the ruleset. PR 5 starts with the dry run (network, `gh pr merge`, Codex's signal).
6. Retire the local sweep.

The routine fires on 22 Nov and 29 Nov during the build. Its PRs are harvested like the others, so it does not need pausing.

## Acceptance criteria

- [ ] All event files validate against the `events` schema, and `/event.schema.json` validates `/events.json`.
- [ ] The checker's tests cover every hold reason plus a clean pass, using fixtures only.
- [ ] Reconciliation: every legacy news URL and every news URL from the harvested PRs is *event* or *held*. **0 missing.**
- [ ] All open `chore/auto-refresh-*` PRs and #147 are closed with a link to the backfill.
- [ ] `/events/` renders. The Funding filter shows only funding events, each with round and amount (or "undisclosed").
- [ ] Every entry detail page's Timeline shows its events. Resource events appear on `/events/` with working `/resources/#<slug>` links.
- [ ] A test proves no held summary or quote reaches any rendered page.
- [ ] `verify:live` covers `/events/`, and the chart variable is in `CHART_VARS`.
- [ ] **One real unattended Sunday run:** the routine opens a PR, the gate is green, Codex reviews with no blocking issue, the routine merges its own PR, `verify:live` passes, and the heartbeat lists published/held counts. Observed, not assumed.
- [ ] The ruleset is active on `main` with an empty bypass list (`gh api repos/de-Blanck/kvantiq-directory/rulesets` is non-empty), and no workflow under `.github/workflows/` was added by this project.
- [ ] The local sweep is gone: `launchctl list | grep kvantiq` shows only `automerge`.

## Left to the builder

File-level layout inside `scripts/events/`; the HTML-to-text approach; date formats accepted; whether the harvest reuses the JSON-aware merge from #85; exact chart styling within the existing site look.

## Open for Rune

1. **Is a company's own announcement enough evidence on its own?** **Decided (Rune, 2026-11-21): yes, for events about that company.** Check 3 accepts a self-published source only when its publisher is the event's primary entity, and the summary is then worded "<Entity> announced …". An event about anyone else still needs a source other than the company. This is an exception to `CLAUDE.md:130,136` (company sites need independent backing) and goes into the "How events work" rulebook section.
2. **Do unconverted legacy news items stay visible while the backfill runs?** **Decided (Rune, 2026-11-21): visible until checked.** Timelines show checked events, then the remaining legacy items under an "Earlier news" heading, exactly as they render today. The backfill searches for original sources over about 4 weeks, spread across runs to stay within search quota. After a fixed cut-off date (one constant, set when the backfill PR merges, about 4 weeks later), legacy items that are still held stop rendering. They stay in the files.
3. **How is the self-merge guard enforced?** **Decided (Rune, 2026-11-21): a Codex review of every weekly PR, plus a GitHub ruleset. No GitHub Actions.**
   - **Codex:** see the merge conditions in §3. Prerequisite (Rune, once): connect Codex's GitHub code review to `de-Blanck/kvantiq-directory`.
   - **Ruleset on `main`** (Rune, once, in repo settings): require a pull request (no direct pushes), block force pushes and branch deletion, and require conversation resolution, so an unresolved Codex comment blocks the merge. No required status checks, since those would need Actions or another check runner. **Empty bypass list.**
   - **Known limit:** the routine acts as Rune's own GitHub account, so no GitHub rule can tell the two apart. A bypass for Rune would be a bypass for the routine, which is why the list is empty, and why "never resolve Codex threads" is an instruction, not something GitHub enforces. The structural fix is giving the routine its own GitHub identity with narrower rights. Worth doing before project 3 puts money behind the pipeline; not in this project.
   - **Unverified until the PR 5 dry run:** how Codex signals "no issues" (a review, a comment or a reaction), and that the routine can read it. If no reliable signal exists, the builder stops and reports.

## Claude's calls (for Rune to check while reading)

- Six types, plus a `subtype` for corporate events only.
- The initial pointer-only list (TQI, Quantum Computing Report). Trade outlets with their own reporting count as sources.
- Each event needs one credible primary source with a verified quote, not three. The ≥3 rule stays per entry.
- Held candidates stop being retried after 8 weeks but are kept.
- Legacy `news` arrays freeze rather than being migrated away.
- `foundOn` for backfilled items comes from git history.
- Human content PRs (new entries, corrections) create no events and are exempt from the fact-change check.
- Resource events link to `/resources/#<slug>`, since resources have no detail pages.
- The routine keeps the run log on `/transparency/sweeps/` alive after the local sweep is retired.
- The routine waits 30 minutes for Codex, and re-checks last week's open PR at the start of each run.
