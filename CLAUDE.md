# CLAUDE.md — Kvantiq Directory

## Project

Kvantiq Directory — a static site directory for the European quantum computing ecosystem. Focused on Nordics + DACH. Optimized for Google SEO and AI/LLM discoverability.

**Live URL:** https://directory.kvantiq.studio
**Repo:** [`de-Blanck/kvantiq-directory`](https://github.com/de-Blanck/kvantiq-directory)

## Tech Stack

- **Astro 6** (static, `output: 'static'`)
- **Tailwind CSS 4** via `@tailwindcss/vite` (config in `@theme` block in `global.css`)
- **React** for interactive components (DetailPage, DetailTabs, ListingView, etc.)
- **Pagefind** for client-side search (postbuild step, unavailable in dev)
- **Zod** schema validation at build time (`src/content.config.ts`)
- **Vercel** free tier hosting

## Commands

```bash
npm run dev          # Start dev server (default port 4321)
npm run build        # Build + pagefind postbuild
npm run preview      # Preview built site
npm run type-check   # astro check — 0 errors required (TypeScript pinned to ^6)
npm test             # Unit tests (node:test via tsx)
npm run audit:content # Content quality audit (RICH/ADEQUATE/SPARSE ratings)
npm run audit:sources # Credible-source counts + the under-bar worklist
```

## Design System: Editorial Light

The site uses an **Editorial Light** theme — warm broken-white, Swiss editorial-inspired. All tokens defined in `src/styles/global.css` `@theme` block.

### Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `void` | `#F8F6F1` | Page background (warm parchment) |
| `base` | `#FFFFFF` | Card backgrounds (clean white) |
| `surface` | `#F2EFE9` | Header, footer, how-to section |
| `elevated` | `#EBE7E0` | Hover states, stat boxes |
| `border` | `#DDD8CF` | All borders (warm taupe) |
| `text-primary` | `#1C1917` | Headings, body (warm near-black) |
| `text-secondary` | `#57534E` | Descriptions, labels |
| `text-muted` | `#78716C` | Timestamps, meta |
| `accent` | `#B45309` | Amber/rust editorial accent |
| `info` | `#1D4ED8` | Nav active, buttons, CTAs |
| `warn` | `#B45309` | Warning badges |
| `error` | `#DC2626` | Error states |

### Critical Rules

- **`shadow-glow` is `none`** — use `shadow-subtle` or `shadow-elevated` instead
- **`text-void` is parchment** — use `text-white` for light text on dark backgrounds
- **No gradients** — `from-accent to-cyan` was Quantum Phosphor. Use solid `bg-info text-white` for CTAs
- **`bg-accent-glow`** maps to subtle amber tint — safe to use on badges
- Logo: use `kvantiq-logo-black.png` (not white)

### Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Headings | Inter Tight | 600-700 | 24-32px |
| Body | Inter | 400 | 15px |
| Card titles | IBM Plex Mono | 600 | 13px uppercase, tracking 0.08em |
| Meta/timestamps | IBM Plex Mono | 400 | 11-12px |
| Tags/badges | IBM Plex Mono | 500 | 10-11px |

## Architecture

### Data Model

JSON files in `src/content/` with Zod schemas in `src/content.config.ts`. Five collections — count each by listing `src/content/<collection>/*.json` rather than relying on a number written here (counts drift; the file system is the source of truth):

- **companies** — name, slug, country, region, type, tags, description, website, products, highlights, accessModel, employees, funding, sources, news
- **benchmarks** — name, slug, algorithm, category, hardware, qubits, framework, keyMetrics, significance, sources, news
- **use-cases** — name, slug, industry, category, problem, approach, results, companies, sources, news
- **challenges** — name, slug, organizer, prizes, eligibility, teamSize, registrationDeadline, problemDomains, sources, news
- **resources** — name, slug, type, lastUpdated, maturity, communitySize, sources, news

### Page Pattern

- Index pages: `src/pages/{type}/index.astro` — table + card grid
- Detail pages: `src/pages/{type}/[slug].astro` — hero + tabbed content
- **Resources have NO detail pages** — index links to external sites only

### Component Pattern for Detail Pages

- `DetailPage.tsx` renders hero + tabs + dashboard grid
- Collection-specific fields are passed via `extraCards` prop from `.astro` files (strings get wrapped in `<p>`)
- `products` and `highlights` are direct props on `DetailPage` (need React rendering)
- `DEFAULT_CARDS` = universal cards (overview, news, related). Do NOT add collection-specific cards here

## Content Quality Thresholds

Run `npm run audit:content` to check. Ratings:

| Collection | ADEQUATE minimum | RICH minimum |
|------------|-----------------|-------------|
| Companies | desc ≥80 chars, employees OR funding | + products, + highlights |
| Benchmarks | desc ≥80 chars, hardware | + keyMetrics, + significance |
| Use Cases | desc ≥80 chars, results | + companies array |
| Challenges | desc ≥80 chars, prizes, dateStart | + eligibility, + problemDomains |
| Resources | desc ≥80 chars | + lastUpdated, + maturity |

## NON-NEGOTIABLE: Content Maintenance Workflow

Every content change MUST follow: Branch → Add/Edit JSON → Build validates → PR with template → CI passes → Owner reviews → Merge → Auto-deploy.

1. Never commit directly to main
2. Every new or edited entry requires **minimum 3 credible verifiable sources** (see "Source credibility" below)
3. All source URLs must be live and accessible
4. PR must use the template
5. CI must pass before merge
6. No blocklisted companies (AWS, Google Cloud, Meta, etc.)
7. Descriptions are factual — no marketing language
8. Slug matches filename

## Source credibility (NON-NEGOTIABLE)

The directory's value depends on every claim being verifiable from independent sources. The minimum bar is **3 credible sources per entry**, drawn from at least two of the categories below.

### ✅ Credible sources (count toward the 3)

- Peer-reviewed papers / arXiv preprints with DOI
- Official institutional pages: universities, research foundations, EU CORDIS, government, regulators
- Established trade press: Reuters, FT, Bloomberg, The Quantum Insider, HPCwire, Inside Quantum Technology, Quantum Computing Report, EU-Startups, TechCrunch, Sifted, Børsen, Berlingske, Politiken, Semiconductor Today
- Regulatory / funding records: Innovation Fund Denmark, EIFO, Vækstfonden, Horizon Europe, EU Quantum Flagship participant records
- Company official press releases — counts as **one source maximum** per entry, must be supplemented by independent sources

### ❌ Not credible (do NOT count toward the 3)

- LinkedIn — self-published
- Crunchbase free-tier — self-listings, low credibility
- Company website alone — counts as ONE source; needs ≥2 independent confirmations beyond it
- Wikipedia — acceptable as a research starting point, does not count toward the bar
- Press-wire syndication (Yahoo Finance, AccessNewswire, PR Newswire syndication) — counts as the same source as the underlying release, not as a separate source

### Cross-checking (NON-NEGOTIABLE)

Three credible sources is necessary but not sufficient — the sources must also **agree**. For every new or edited entry, cross-check the gathered sources against each other and against the entry's own fields (name, country, type, founding year, funding, key claims). If sources contradict each other or an entry asserts something a source does not support, resolve it before publishing — prefer the higher-credibility source, and never publish a claim that the sources cannot jointly substantiate. The weekly sweep runs this cross-check per entry and records contradictions in the Sweep Log (`/transparency/sweeps`).

### Credible-source counting and the backfill bar

"Credible" = a source NOT on the blocklist above (the `isBlocklistedSource` test in `scripts/ai-sweep.mjs` is the canonical definition). Run **`npm run audit:sources`** to see each entry's credible-source count and the backfill worklist (`--strict` exits non-zero when any entry is below the bar — use it as the gate once a collection is backfilled).

The 3-credible-source minimum applies to **all new entries and any edited entries going forward** (enforced by the sweep flag, the PR template, and `audit:sources`).

**Entries below the bar are not published.** Since 2026-09-02 the site enforces this at render time: an under-bar entry is excluded from every listing, from the homepage, from country pages, from `llms-full.txt`, from the search index and from the sitemap, and its detail page is served `noindex, follow` with a banner explaining why. All of them are listed publicly on `/transparency/audit/`. The gate lives in `src/lib/source-bar.ts`, which imports `isBlocklistedSource` from `scripts/ai-sweep.mjs` rather than reimplementing it — the site, the sweep and `audit:sources` must never disagree about what "credible" means.

Withholding rather than deleting is deliberate: the URLs stay alive so nothing already indexed becomes a 404. An entry returns to the directory by gaining a third credible source, never by lowering the bar.

As of 2026-09-03, **2 of 226 entries are below the bar** and therefore unpublished — `challenges/qhack-2025` and `challenges/quantum-game-jam-2025`, both assessed as genuinely unsourceable rather than merely un-backfilled (the 2026-06-24 figure of ~166 of 218 predates the source-backfill workstream).

The Zod schema in `src/content.config.ts` is raised to `.min(3)` **per collection only after that collection clears `audit:sources --strict --collection <name>`** — flipping it early turns an unpublished entry into a build failure. Companies, benchmarks, use-cases and resources are at `.min(3)`; **challenges stays at `.min(2)`** until those two entries either gain a third source or are removed. The schema is a backstop, not the gate: it counts raw sources while the publish gate counts *credible* ones, so `src/lib/source-bar.ts` remains the thing that decides what ships.

## Git Workflow

- **Never commit to main.** Always work on a feature branch. The `block-commit-to-main` hook enforces this globally.
- **Verify branch before committing:** `git branch --show-current` should show a `feature/`, `fix/`, or `content/` branch.
- **Stage generated files before switching branches.** Any file you create must be `git add`ed in the same turn, OR placed in a gitignored scratch dir. Never leave generated work untracked — past sessions lost documentation during branch switches.
- **Escape hatch:** If you truly need to commit to main (e.g., updating CLAUDE.md on main itself), append `#allow-main-commit` to the commit command.

## Context & Autonomy

Instantiates the global Context Window Management rules (`~/.claude/CLAUDE.md`) for this repo.

- **Always redirect, then `tail -20`:** these commands are verbose or hit APIs and will flood context if run raw —
  - `node scripts/scheduled-run.mjs` (AI content sweep)
  - `npm run build` (Astro + pagefind)
  - `npx vercel@latest deploy --prod --yes`
  - `npm run audit:sources` / `npm run audit:content`

  Run as `cmd > some.log 2>&1` then `tail -20 some.log`; open the full log only if the tail shows a problem.
- **Handoff artifact:** `STATUS.md` at repo root — current content/deploy state, source-backfill progress, and the next step. Read it at session start; update it before ending or handing off.
- **Phase map for long content work:** sweep → source-backfill (one collection at a time) → build/validate → deploy. Each phase commits on its own branch and updates `STATUS.md` before the next begins.
- **Always delegate to a subagent:** reading `src/content/**` (200+ JSON entries) and full `audit:sources` output. Return counts and the worklist, not raw dumps.

## Windows Environment

- **Playwright/Chrome MCP are unreliable on Windows.** Prefer manual screenshot verification or skip visual checks unless the user specifically requests them.
- **Turbopack cache errors:** If the dev server crashes with junction-point or cache errors, delete `.next` (or the Astro equivalent `dist` + `node_modules/.astro`) before retrying.
- **Paths:** Use forward slashes or quoted paths in bash. `rm -rf` fails on bracket-named directories — use `rm -r` without force, or quote the path.
- **Never chain `cd` with `&&`.** Use `git -C <path>` or `npm --prefix <path>` instead. This is enforced by a hook.

## UI Iteration

- **Verify before claiming done.** When the user reports a UI issue, read the current file or take a screenshot BEFORE asserting it's already fixed. Past sessions falsely claimed work was complete without re-checking state.
- **Paper MCP `insert-children` always appends.** Plan node ordering up front — you cannot insert in the middle.
- **Provide concrete acceptance criteria before iterating.** For design work, define contrast ratios, spacing values, and reference screenshots up front. Vague "make it look better" loops burn cycles.
- **Show evidence with every completion claim.** File snippet, command output, or screenshot — if you can't verify, say so explicitly.
