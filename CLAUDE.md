# CLAUDE.md — Kvantiq Directory (feature/directory-site worktree)

## Project

Kvantiq Directory — a static site directory for the European quantum computing ecosystem. Focused on Nordics + DACH. Optimized for Google SEO and AI/LLM discoverability.

**Live URL:** https://directory.kvantiq.studio
**Branch:** feature/directory-site
**Worktree:** E:\kvantiq-directory\.worktrees\feature-directory-site\

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
2. Every entry requires minimum 2 verified sources
3. All source URLs must be live and accessible
4. PR must use the template
5. CI must pass before merge
6. No blocklisted companies (AWS, Google Cloud, Meta, etc.)
7. Descriptions are factual — no marketing language
8. Slug matches filename
