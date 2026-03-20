# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Kvantiq Directory — a static site directory for the European quantum computing ecosystem (companies, benchmarks, use cases, challenges, resources). Focused on Nordics + DACH, optimized for Google SEO and AI/LLM discoverability.

## Repository Structure

The repo uses **git worktrees**. The `main` branch is the repo root (`E:\kvantiq-directory`). Active development happens on the `feature/directory-site` branch in the worktree at `.worktrees/feature-directory-site/`.

When working on the site, operate from the worktree directory:
```
E:\kvantiq-directory\.worktrees\feature-directory-site\
```

## Tech Stack

- **Astro 6** (static site generator, `output: 'static'`)
- **Tailwind CSS 4** via `@tailwindcss/vite` plugin (not `@astrojs/tailwind`)
- **Astro Content Collections** with Zod schema validation for all data
- **Pagefind** for client-side search (runs as postbuild step)
- **@astrojs/sitemap** for sitemap generation
- **Vercel** free tier for hosting
- Site URL: `https://directory.kvantiq.studio`
- Node.js >= 22.12.0

## Commands

All commands run from the worktree directory (`.worktrees/feature-directory-site/`):

```bash
npm run dev        # Start dev server
npm run build      # Build static site (also runs pagefind postbuild)
npm run preview    # Preview built site locally
```

Build output goes to `dist/`. Pagefind generates its index in `dist/pagefind/`.

## Architecture

### Data Model

All directory data is JSON files in `src/content/` organized by collection type. Schemas are defined in `src/content.config.ts` using Zod via Astro Content Collections. Collections:

- **companies** — `src/content/companies/*.json` (fields: name, slug, country, region, type, tags, description, website, featured, etc.)
- **benchmarks** — `src/content/benchmarks/*.json`
- **use-cases** — `src/content/use-cases/*.json`
- **challenges** — `src/content/challenges/*.json`
- **resources** — `src/content/resources/*.json`

Schema validation happens at build time — invalid JSON breaks the build.

### Page Generation Pattern

Every content type follows the same pattern:
1. **Index page** (`src/pages/{type}/index.astro`) — comparison table + card grid + `ItemList` JSON-LD
2. **Detail page** (`src/pages/{type}/[slug].astro`) — uses `getStaticPaths()` + `getCollection()`, includes type-specific JSON-LD schema + FAQ section + summary block with `role="doc-abstract"`
3. Companies also have **country filter pages** at `src/pages/companies/country/[country].astro`
4. Resources only have an index page (links out to external sites)

### Layout & Components

- `src/layouts/BaseLayout.astro` — HTML shell with SEO meta (Open Graph, Twitter Cards), JSON-LD (`SpeakableSpecification` on every page), Pagefind `data-pagefind-body` on `<main>`
- `src/components/JsonLd.astro` — renders `<script type="application/ld+json">`
- `src/components/Header.astro` / `Footer.astro` — site-wide nav (marked `data-pagefind-ignore`)
- `src/components/ListingCard.astro` — reusable card for grid layouts
- `src/components/TagList.astro` — tag pill list
- `src/components/SearchBar.astro` — Pagefind UI widget
- `src/components/NewsletterSignup.astro` — email capture form

### AI/LLM Optimization

The site is specifically designed for AI crawler extraction:
- `public/robots.txt` — explicitly allows 17+ AI crawler user agents
- `public/llms.txt` — spec-compliant site summary for LLMs
- `src/pages/llms-full.txt.ts` — build-time endpoint that concatenates all collection entries
- Every detail page outputs semantic HTML5 with question-format H2 headings, `<time datetime="">` elements, and FAQ sections with `FAQPage` JSON-LD schema

### JSON-LD Schema Types by Page

| Page Type | Schema.org Type |
|-----------|----------------|
| Company | `Organization` + `FAQPage` |
| Benchmark | `Dataset` + `FAQPage` |
| Use Case | `Article` + `FAQPage` |
| Challenge | `Event` |
| Resource | `LearningResource` |
| All index pages | `ItemList` |
| All pages | `SpeakableSpecification` (via BaseLayout) |

## NON-NEGOTIABLE: Content Maintenance Workflow

Every content change — whether by AI or human — MUST follow this pipeline. No exceptions.

### The Pipeline

```
Branch → Add/Edit JSON → Build validates → PR with template → CI passes → Owner reviews → Merge → Auto-deploy
```

### Rules

1. **Never commit directly to main.** All changes go through a feature branch and PR.
2. **Every entry requires minimum 2 verified sources.** Enforced by Zod schema (`sources.min(2)`) and CI. Build fails without them.
3. **All source URLs must be live and accessible.** CI validates URL format. PR reviewer spot-checks.
4. **PR must use the template.** The template at `.github/pull_request_template.md` has mandatory checklists for source verification, schema compliance, ethics, and preview.
5. **CI must pass before merge.** The GitHub Actions workflow validates: build, duplicate slugs, minimum sources, valid URLs, and blocklist compliance.
6. **No blocklisted companies in the companies collection.** AWS, Google Cloud, Meta, etc. are never listed as companies. Blocklisted company challenges use DuckDuckGo URLs. Open-source tools from blocklisted companies keep direct links.
7. **Descriptions are factual.** 2-3 sentences, no marketing language, no superlatives.
8. **Slug matches filename.** `my-company.json` must have `"slug": "my-company"`.

### CI Checks (all must pass)

| Check | What it validates |
|-------|------------------|
| `npm run build` | Zod schema validation — catches missing/invalid fields, <2 sources |
| Duplicate slugs | No two entries in same collection share a slug |
| Source count | Every entry has >= 2 sources |
| Source URLs | All source URLs start with `http` |
| Blocklist | No company entries link to blocklisted domains |

### How the owner audits

- **PR diff** shows exactly which entries were added/changed
- **PR template checklist** requires source verification, ethics check
- **Vercel preview deploy** on every PR — see the site before merging
- **Git history** is the permanent audit trail — every change attributed
- **Source URLs** in every JSON entry link back to verifiable references

### Adding New Content

1. Create a branch: `git checkout -b content/add-{description}`
2. Add JSON files to `src/content/{collection}/` matching the Zod schema in `src/content.config.ts`
3. Each entry needs: all required fields + `sources` array with >= 2 verified sources
4. Run `npm run build` locally to validate
5. Push and open a PR — fill out the template completely
6. Wait for CI to pass and owner to review
7. Owner merges → Vercel auto-deploys

## Design Spec & Implementation Plan

Detailed specification: `docs/superpowers/specs/2026-03-18-kvantiq-directory-design.md`
Implementation plan: `docs/superpowers/plans/2026-03-18-kvantiq-directory.md`

## Ethics Policy

The site follows strict ethical guidelines:
- European-first, open-source preferred for affiliate links
- No third-party tracking (no Google Analytics, no Facebook pixels)
- No Google AdSense — only EthicalAds or Carbon Ads (contextual, no profiling)
- Companies listed based on alignment with open science and European tech sovereignty
- See the design spec for the full affiliate allowlist/blocklist
