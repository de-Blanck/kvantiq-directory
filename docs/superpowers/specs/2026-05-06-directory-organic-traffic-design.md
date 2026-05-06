---
title: directory.kvantiq.studio organic traffic — generation + monitoring
date: 2026-05-06
status: draft (awaiting Rune approval)
owner: Kvantiq Studio (Rune)
repo: kvantiq-directory
phase: 1 of 3 (Hardening pass + measurement loop)
---

# Spec: directory.kvantiq.studio organic traffic — generation + monitoring

## Goal

Drive measurable organic discovery to `directory.kvantiq.studio`, optimized
**primarily for citation by LLMs** (ChatGPT, Claude, Perplexity, Gemini) and
**secondarily for network-effect growth** via low-friction third-party
submissions. The two outcomes reinforce each other: more entries grow the LLM
answer surface; LLM citation visibility incentivises companies to submit.

## Strategy

Two complementary outcomes (chosen during brainstorming on 2026-05-06 over
conversion-funnel and Google-SEO-only options):

- **C — LLM citation** as the **headline** goal. The directory should be the
  cited source when LLMs answer questions about European quantum companies,
  benchmarks, use cases, and challenges.
- **D — Network effect via Submit Listing** as the **growth engine**. Streamlined
  submission flow lets non-developer founders contribute, growing the citation
  surface without solo-curation cost. Phase 2 work; designed but not built in
  Phase 1.

## Non-goals (explicit)

- Conversion funnel from directory → Kvantiq Studio platform (option A — rejected)
- Pure authority-moat play without measurement (option B — rejected as too vague)
- Open submissions with auto-publish (option E — rejected; destroys C)
- Multi-language site
- Mobile app
- Any work in `synapse_q_deployment` repo (this spec is fully contained in `kvantiq-directory`)

## North-star metric

**`cited%`** — the share of LLM responses across a fixed 30-prompt panel × 4
production-tier models (120 calls per run) that include the URL
`directory.kvantiq.studio`. Tracked weekly. **Per-model breakdown reported
alongside aggregate** (Perplexity is web-grounded and will dominate the
aggregate; per-model is the truer signal).

Supporting metrics:

- **Layer B — inbound traffic:** weekly unique visitors via Plausible + Google
  Search Console + Bing Webmaster + LLM referrers (ChatGPT, Perplexity).
- **Layer C — corpus health:** total entries per collection, % RICH /
  ADEQUATE / SPARSE, % at ≥3 sources, median freshness from `news[]`.

## Architecture overview

Four components:

1. **Citation-probe panel** — scheduled weekly job that queries 4 LLM APIs with
   30 stable prompts, scores responses, persists results.
2. **Hardening layer** — fixes to the existing Astro static site that increase
   LLM-readable signal density (schema, sitemaps, OG, internal links,
   monitoring instrumentation).
3. **Submission flow** — web form on `/submit` that creates GitHub PRs with
   validated submission JSON. **Phase 2; designed but not built in Phase 1.**
4. **Public transparency surface** — `/transparency/citations` and
   `/transparency/audit` pages that publish probe results and corpus health.

Phase 1 ships components 1, 2, and 4. Component 3 is Phase 2.

---

## Phase 1 — Hardening pass (week 1, ~3-5 hrs focused)

### 1. Fix `robots.txt` sitemap reference

Current state: `Sitemap: https://directory.kvantiq.studio/sitemap.xml` — this
URL returns 404. Astro generates `sitemap-index.xml` instead.

Fix: change the line in `public/robots.txt` to:

```
Sitemap: https://directory.kvantiq.studio/sitemap-index.xml
```

Re-deploy. Single-line change, site-wide impact for any crawler that strictly
follows robots.txt.

### 2. Per-collection JSON-LD audit + completion

Detail page templates currently emit varying levels of structured data.
Required state after Phase 1:

| Page template | Schema type | Required fields |
|---|---|---|
| `companies/[slug].astro` | `Organization` (✓ present) | `name`, `url`, `description`, `foundingDate`, `address`, `numberOfEmployees`, `funding` |
| `benchmarks/[slug].astro` | `Dataset` (new) | `name`, `description`, `keywords`, `measurementTechnique`, `variableMeasured`, `creator`, `temporalCoverage` |
| `use-cases/[slug].astro` | `Article` (new) | `headline`, `description`, `about` (links Industry + Companies), `articleSection` |
| `challenges/[slug].astro` | `Event` (new) | `name`, `description`, `organizer`, `offers` (prizes), `eligibilityToWorkRequirement`, `startDate`, `endDate` |
| `resources/index.astro` | `ItemList` of `LearningResource` (new) | per-item: `name`, `description`, `learningResourceType`, `educationalLevel`, `url` |

Implementation: each page-template `.astro` file builds a JSON-LD object from
the entry's collection data and passes it to `BaseLayout` via the existing
`jsonLd` prop.

Validation gate: every modified page must pass Google Rich Results Test before
the PR merges. Manual check in Phase 1; automated in Phase 2 spec.

### 3. Fix `SpeakableSpecification`

Current state: `BaseLayout.astro` lines 60-68 emit a `SpeakableSpecification`
schema with `cssSelector: [".summary", ".faq"]`. Those classes do not exist on
the rendered DOM, so the schema is a no-op.

Fix (default option **a**): add `class="summary"` to the description block in
`DetailPage.tsx` so the speakable selector points at real content. The `.faq`
selector is deferred — when an FAQ block is added (separate ticket), the
selector becomes valid for that section too.

Alternative option **b**: remove the `SpeakableSpecification` block from
`BaseLayout.astro` until both selectors point at real DOM. Defer to
implementer; option **a** is preferred because it preserves the AI-extraction
hint with minimum work.

### 4. Per-entry OG images

Current state: every detail page falls back to `/og-images/default.png` because
no `ogImage` prop is passed to `BaseLayout`. Every shared link looks identical
on LinkedIn, Twitter, Slack.

Fix: build-time generation of 1200×630 PNG per detail page (~141 images).

Implementation:

- Astro endpoint: `src/pages/og-images/[collection]/[slug].png.ts`
- Library: `satori` (HTML→SVG) + `@resvg/resvg-js` (SVG→PNG), both standard for
  Astro static OG generation
- Template renders three layers on the Editorial Light palette:
  - Eyebrow: collection type (e.g. "COMPANY", "BENCHMARK") in IBM Plex Mono
    11px uppercase, tracking 0.08em, `text-secondary`
  - Heading: entry name in Inter Tight 60-72px bold, `text-primary`
  - Subhead: 2-3 key facts (country/region/type for companies; algorithm/qubits
    for benchmarks; etc.) in IBM Plex Mono 16px, `text-muted`
  - Footer: `directory.kvantiq.studio` watermark + Kvantiq logomark
- Per-page `BaseLayout` prop: `ogImage={`/og-images/${collection}/${slug}.png`}`

Cost: ~141 PNGs × ~50KB = ~7 MB added to dist. Negligible.

### 5. Internal-link audit

Verify cross-collection `<a>` links render in static HTML on detail pages.
`lib/related.ts` already computes related items via `findRelated`, but the
rendered HTML must preserve them as crawlable `<a href="...">` links (not
JS-only).

Process:

1. After dev build, `WebFetch` one company page, one use-case page, one
   challenge page
2. Confirm the `Related` cards are rendered as static `<a>` tags pointing at
   `/companies/<slug>/`, `/use-cases/<slug>/`, etc.
3. If links are JS-rendered (because `DetailPage.tsx` hydrates with
   `client:load`), refactor to render the `<a>` server-side and let React
   hydrate over them, OR move related-items rendering into the `.astro` page
   template.

Spot-check, not automated test, in Phase 1. Promotes to a Playwright test in
Phase 2.

### 6. Monitoring instrumentation

Add to `BaseLayout.astro` `<head>`:

```html
<!-- Plausible (privacy-friendly, GDPR-clean) -->
<script defer data-domain="directory.kvantiq.studio"
  src="https://plausible.io/js/script.js"></script>

<!-- Search engine verification -->
<meta name="google-site-verification" content="<token from GSC>" />
<meta name="msvalidate.01" content="<token from Bing Webmaster>" />
```

After deploy:

- Submit `https://directory.kvantiq.studio/sitemap-index.xml` to Google Search
  Console (one-time, manual)
- Submit same URL to Bing Webmaster Tools (one-time, manual)
- Confirm Plausible script loads (curl + grep)

Tool choice rationale: Plausible chosen for GDPR-cleanliness (no cookie
banner needed), lightweight script (~1 KB), alignment with Kvantiq's
EU-sovereignty stance. Umami (self-hostable on existing Vercel) is an
acceptable alternative; swap freely if cost or data sovereignty drives a
change.

### 7. Citation-probe baseline

**Day 1 task — must ship before any other Phase 1 change.** Run probe v1
(see Section 2 below) and commit `data/probes/runs/2026-05-06-baseline.json`
as the comparison point for the entire Phase 1 effort.

Without this baseline, no subsequent change is attributable.

### 8. Source-bar backfill (background workstream)

`kvantiq-directory/CLAUDE.md` notes: existing entries below the 3-source
threshold need backfilling, and the Zod schema in `src/content.config.ts`
will be raised from `.min(2)` to `.min(3)` per collection only after
backfill is complete.

Repurpose the existing weekly agent script in `scripts/` to:

1. Identify entries with exactly 2 credible sources
2. Search for a viable 3rd source per the credibility rubric in `CLAUDE.md`
3. Open one PR per entry with the proposed 3rd source

Owner reviews + merges PRs at normal cadence. Runs in parallel with the rest
of Phase 1; doesn't block any other task.

---

## Phase 1 — Citation-probe panel (component 1)

### Probe set: 30 prompts, version-locked

Stored in `data/probes/prompts.json` v1. Five dimensions × 6 prompts each:

| Dimension | Prompts (6 each) |
|---|---|
| **Geographic** | "What are the leading **{Sweden / Denmark / Finland / Germany / Austria / Switzerland}** quantum computing companies?" |
| **Modality** | "What companies build **{trapped-ion / superconducting / photonic / neutral-atom / quantum-sensing / cryogenic-infrastructure}** quantum technology in Europe?" |
| **Category** | "What European quantum **{hardware / software / services / benchmarks / use cases / hackathons}** should I know about?" |
| **Specific entity** | "Tell me about **{Pasqal / IQM / Bluefors / AQT / Quandela / ID Quantique}** — who are they and what do they do?" |
| **Discovery intent** | "I'm a **{student / researcher / journalist / investor / policymaker / engineer}** interested in European quantum — where do I find structured info?" |

Total: 30 prompts. **Version-locked.** If the panel needs to evolve, bump to
v2 and run both v1 and v2 in parallel for 4 weeks of overlap before retiring
v1. Comparing across versions without overlap is invalid.

### Models tested (4 production-tier)

| Provider | Model | Notes |
|---|---|---|
| OpenAI | `gpt-4o` | Production-tier, no tools |
| Anthropic | `claude-sonnet-4-6` | Production-tier, no tools |
| Perplexity | `llama-3-sonar-large-online` | **Web-grounded** — most likely to return URLs |
| Google | `gemini-2.0-pro` | Production-tier, no tools |

Reasoning-tier models (o1, Opus 4.7, Gemini Deep Research) excluded from
weekly probe — separate quarterly "deep track" run.

### Scoring rubric (per response)

| Score | Criterion |
|---|---|
| **2 — Cited** | Response contains the URL `directory.kvantiq.studio` (any path) |
| **1 — Mentioned** | Response references "Kvantiq Studio" or "Kvantiq Directory" by name without URL |
| **0 — Absent** | Neither |

Per-run aggregates:

- Per-model `cited%` and `mentioned%`
- Overall weighted score across all 4 models
- **Headline KPI: per-model `cited%` weekly trend** (NOT aggregate, because
  Perplexity dominates the aggregate)

### Runner

`scripts/citation-probe.ts`:

- Reads `data/probes/prompts.json`
- For each (prompt, model) tuple: send prompt, capture full response text, score
- Writes `data/probes/runs/YYYY-MM-DD.json` (full responses + scores)
- Appends row to `data/probes/history.json` (aggregate scores only — keeps the
  history file small)
- Writes `data/probes/runs/YYYY-MM-DD.md` summary for human review

API keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`,
`GOOGLE_API_KEY` — stored as GitHub Actions secrets.

Estimated cost: ~$2-5 per run (120 short calls), ~$10-25/month at weekly
cadence.

### Schedule

GitHub Actions workflow `.github/workflows/citation-probe.yml`:

- Trigger: `schedule: cron: '0 9 * * 1'` (Mondays 09:00 UTC)
- Manual trigger: `workflow_dispatch`
- On success: opens PR with new probe results, auto-merge enabled (results
  PRs are append-only — `data/probes/runs/<date>.json` + a single appended
  row in `data/probes/history.json` — so they don't require human review).
  This respects the `block-commit-to-main` hook because all writes still
  land via PR, not direct push.
- **Day-1 baseline:** run before any Phase 1 change ships, commit as
  `data/probes/runs/2026-05-06-baseline.json`

### Public surfacing

`src/pages/transparency/citations.astro` — new page under existing Transparency
nav:

- Latest run summary (date, headline `cited%` per model, overall trend)
- 12-week trend chart (per model)
- Methodology disclosure: prompts list, models, scoring rubric, link to
  GitHub Action source
- Raw history downloadable as CSV

Page reinforces "show your work" brand positioning and is itself a citable
artifact.

---

## Phase 1 — Monitoring stack (component 2)

Three layers, all visible from a single weekly review:

| Layer | Source | Frequency | Output |
|---|---|---|---|
| **A — LLM citation** | Probe panel | Weekly (Mon 09:00 UTC) | `data/probes/runs/*.md` + `/transparency/citations` |
| **B — Inbound traffic** | Plausible cloud (€9/mo) + Google Search Console + Bing Webmaster | Continuous | Plausible dashboard + GSC dashboard |
| **C — Corpus health** | `npm run audit:content` | Weekly (GitHub Actions) | `data/content-audits/YYYY-MM-DD.md` + `/transparency/audit` (already exists) |

---

## Phase 1 — Iteration loop

| Cadence | Action |
|---|---|
| **Weekly (Mon morning, ~15 min)** | Review probe summary + content-audit summary. Three questions: (1) did `cited%` move per model? (2) which prompts/models lost ground? (3) which collections degraded? Append one-line status to `data/probes/history.json` `notes` column. |
| **Monthly** | Decide one intervention (new entries on a thin modality? schema fix? entry backfill priority?). Implement during the month. Re-measure next month. |
| **Quarterly** | Rerun "deep track" probe with reasoning-tier models (o1, Opus 4.7, Gemini Deep Research). Decide whether v1 prompt panel needs to evolve to v2. |

---

## Phase 1 — Build sequence (week 1)

| Day | Tasks | Owner |
|---|---|---|
| **1** | Run probe baseline; commit `data/probes/runs/2026-05-06-baseline.json` **before any other change** | Claude (orchestrator) |
| 1-2 | `robots.txt` fix; submit sitemap to GSC + Bing Webmaster; add Plausible + verification metas to `BaseLayout` | Claude |
| 2-3 | Per-collection JSON-LD audit + completion (Benchmarks → `Dataset`, Use Cases → `Article`, Challenges → `Event`, Resources index → `ItemList`) | Claude or Codex worker |
| 3-4 | Fix `SpeakableSpecification` selectors (add `.summary` to `DetailPage` description) | Claude |
| 4-5 | Per-entry OG image generation (satori build-time endpoint) | Claude or Codex worker |
| 5 | Internal-link audit + spot-check via WebFetch on 3 representative pages | Claude |
| 5+ | Source-bar backfill via existing weekly agent (background, non-blocking) | Existing agent |
| **8 (week 2 Mon)** | First post-baseline probe re-run; measure delta; record in spec follow-up | GitHub Actions schedule |

---

## Phase 2 — Submit flow (week 2-3) — designed, not built in Phase 1

Web form on `/submit` (currently a static page) creates a GitHub PR with
submission JSON. This is the chosen gate (option B from brainstorming).

Build details deferred to a Phase 2 spec:

- Form UI (Astro page + React form component)
- Server-side endpoint (Vercel function) that opens the PR
- Anti-spam: rate limit by IP, hCaptcha, source-URL liveness check
- PR template integration: pre-fills the existing template with form data
- Quality bar: schema validation in CI must still pass; human review still
  required

---

## Risks and decisions to revisit

| Risk | Mitigation |
|---|---|
| Probe `cited%` doesn't move within 4-8 weeks | Monthly intervention picks one specific lever (schema, OG, new entries) and isolates impact. If 12 weeks at flat baseline, prompt panel v2 + reasoning-tier models considered. |
| Perplexity dominates aggregate, masks signal in other models | Reported per-model not just aggregate. Headline is *per-model trend*, not single number. |
| LLM model providers change weights or APIs deprecate | Probe runner is provider-agnostic; new model is a config addition. Locked prompt panel survives provider churn. |
| Entry backfill workstream produces low-quality 3rd sources | Existing source-credibility rubric in `CLAUDE.md` is enforced by `audit:content`; PRs from agent require human review same as any other PR. |
| Public probe dashboard incentivises others to game prompts | Prompts are version-locked; v2 changes require 4-week parallel run for continuity. Gaming would require systematically polluting all 4 LLM corpora — high cost for low payoff. |
| OG image generation breaks the build on Vercel free tier | Satori is well-tested on Vercel; if build time exceeds the limit, downgrade to "OG image per collection type" (5 images) instead of per-entry. |

---

## Out of scope (explicit, will not be implemented in Phase 1)

- Web-form submit flow → Phase 2
- AI-assisted moderation queue → Phase 3
- Claim-listing flow → Phase 3+
- Schema validation in CI → Phase 2 (manual via Google Rich Results Test for now)
- Translations, multi-language → out of scope entirely
- Anything touching `synapse_q_deployment` → out of scope

---

## Success criteria for Phase 1 (8-week horizon)

- ✅ Probe baseline recorded and weekly cadence running for ≥4 weeks
- ✅ Per-collection JSON-LD validates against schema.org + Google Rich Results Test
- ✅ `cited%` baseline + 1 datapoint of measurable delta (positive or negative
  — "we changed X, citation moved by Y")
- ✅ Inbound traffic via Plausible has ≥4 weeks of data (so we can compute
  week-over-week trends)
- ✅ `/transparency/citations` page is publicly live
- ✅ `robots.txt` `Sitemap:` line resolves to a 200, not 404

The objective for Phase 1 is **not** to move `cited%` to a target. It is to
**establish the closed measurement loop** so Phase 2+ interventions are
attributable.

---

## Provenance

- Brainstormed via `superpowers:brainstorming` on 2026-05-06
- Decisions locked: strategy (C+D), metric (per-model `cited%` headline +
  Plausible/GSC/audit supporting), gate (web form → PR, deferred to Phase 2),
  sequencing (hardening first)
- Site recon completed 2026-05-06 — see commit message for the bug list this
  spec resolves
