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
npm run audit:content # Content quality audit (RICH/ADEQUATE/SPARSE ratings)
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

JSON files in `src/content/` with Zod schemas in `src/content.config.ts`:

- **companies** (74) — name, slug, country, region, type, tags, description, website, products, highlights, accessModel, employees, funding, sources, news
- **benchmarks** (32) — name, slug, algorithm, category, hardware, qubits, framework, keyMetrics, significance, sources, news
- **use-cases** (23) — name, slug, industry, category, problem, approach, results, companies, sources, news
- **challenges** (12) — name, slug, organizer, prizes, eligibility, teamSize, registrationDeadline, problemDomains, sources, news
- **resources** (42) — name, slug, type, lastUpdated, maturity, communitySize, sources, news

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

### Existing entries below the bar

The 3-source bar applies to **all new entries and any edited entries going forward**. Backfilling existing entries that currently have only 2 sources is a separate, deliberate workstream — the Zod schema in `src/content.config.ts` remains at `.min(2)` for now, and will be raised to `.min(3)` per collection only after that collection has been brought up to the new bar.

## Git Workflow

- **Never commit to main.** Always work on a feature branch. The `block-commit-to-main` hook enforces this globally.
- **Verify branch before committing:** `git branch --show-current` should show a `feature/`, `fix/`, or `content/` branch.
- **Stage generated files before switching branches.** Any file you create must be `git add`ed in the same turn, OR placed in a gitignored scratch dir. Never leave generated work untracked — past sessions lost documentation during branch switches.
- **Escape hatch:** If you truly need to commit to main (e.g., updating CLAUDE.md on main itself), append `#allow-main-commit` to the commit command.

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
