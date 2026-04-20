# Kvantiq Directory — UI Swarm Design Contract

**Version:** 1.0 · **Generated:** 2026-04-20 · **Base branch:** `feature/kvantiq-studio-branding`

> This file is the SINGLE SOURCE OF TRUTH. If you are an agent reading this and unsure what something should look like, the answer is IN this file. Re-read before inventing. Do not modify this file.

---

## 1. Visual intent (reference look)

Dark editorial-tech marketing site. Kvantiq Studio brand. Surfaces are **void** (deep near-black), typography is **Geist** (prose) + **IBM Plex Mono** (uppercase labels, data, code). The **phosphor green → cyan quantum gradient** is the signature brand touch, used sparingly (hero accents, top-of-page hairline, nav underline, focus rings, button hover glow). Cards use BORDERS, not shadows, except on hover. Editorial over glitzy — less is more.

**H1 rule (NON-NEGOTIABLE):** H1 headings are ALWAYS solid `text-text-primary`. NEVER apply `.text-gradient-quantum` to an entire H1. The gradient utility is permitted only on short hero words/phrases *inside* a paragraph or as a single accent span within an H2/H3 — not on whole page titles.

Peer aesthetic: Linear, Vercel, Anthropic, IBM Quantum. Marketing body reads at 17-18px with 1.65 line-height — Stripe / Apple HIG territory.

---

## 2. Color tokens (canonical — `global.css` `@theme`)

All colors MUST resolve to one of these tokens via Tailwind (`bg-void`, `text-text-primary`, etc.). No raw hex in components except the two brand-gradient stops `#00E6A0` / `#00D4FF` inside SVG stroke attributes where CSS vars can't be used.

| Token | Hex | Role |
|-------|-----|------|
| `--color-void` | `#06090F` | page bg (marketing-dark void.base) |
| `--color-base` | `#0d1117` | card bg (void.elevated) |
| `--color-surface` | `#0d1117` | header/footer bg |
| `--color-elevated` | `#141b25` | hover surfaces |
| `--color-border` | `#1b2332` | default border (void.border) |
| `--color-text-primary` | `#F8FAFC` | primary text (slate-50) |
| `--color-text-secondary` | `#C4BEB7` | secondary text (marketing-text-secondary) |
| `--color-text-muted` | `#A09A93` | muted text (marketing-text-tertiary) |
| `--color-accent` / `--color-info` | `#00E6A0` | phosphor — CTAs, active nav, links |
| `--color-accent-hover` | `#00CC8E` | phosphor hover |
| `--color-accent-glow` | `rgba(0,230,160,0.12)` | subtle phosphor tint |
| `--color-cyan` | `#00D4FF` | secondary accent (gradient-only, no solid fills) |
| `--color-warn` | `#FFAA00` | warning amber |
| `--color-error` | `#EF4444` | error red |
| `--gradient-quantum` | `linear-gradient(135deg, #00E6A0 0%, #00D4FF 100%)` | brand gradient (utility: `.text-gradient-quantum`) |
| `--gradient-quantum-soft` | linear-gradient with 12% alpha stops | subtle background wash |

**Banned colors:** raw white `#fff` / `text-white` (use `text-text-primary`); raw black; `#52525B` (DS ban); editorial warm palette (`#B45309`, `#1D4ED8`, `#0F766E`) — these are leftover from the old Editorial Light theme.

---

## 3. Typography tokens (Kvantiq DS v1.1 — `typography.json`)

Every typography declaration MUST use one of these utilities or Tailwind `text-*` classes (which are already aligned to DS via `@theme` override). **No arbitrary `text-[Npx]` values.**

### Utilities (semantic, responsive)

| Utility | Mobile | Desktop | Weight | Tracking | LH | Font | Maps to DS token |
|---------|--------|---------|--------|----------|-----|------|------------------|
| `.h-display` | 40 | 64 | 700 | -0.03em | 1.1 | Geist | marketing.hero-headline |
| `.h-xl` | 32 | 44 | 600 | -0.02em | 1.2 | Geist | marketing.section-title |
| `.h-lg` | 20 | 24 | 500 | -0.01em | 1.4 | Geist | marketing.subheadline |
| `.h-md` | 18 | 20 | 600 | 0 | 1.35 | Geist | directory-local card title |
| `.h-sm` | 16 | 17 | 600 | 0 | 1.4 | Geist | directory-local sub-head |
| `.body-lg` | 18 | 19 | 400 | 0 | 1.65-1.7 | Geist | emphasized body |
| `.body-default` | 17 | 18 | 400 | 0 | 1.65 | Geist | marketing.body |
| `.body-sm` | 14 | 15 | 400 | 0 | 1.55 | Geist | caption / table meta |
| `.eyebrow` | 12 | 13 | 500 | 0.08em UC | 1.4 | Mono | marketing.eyebrow |
| `.eyebrow-lg` | 13 | 14 | 500 | 0.08em UC | 1.4 | Mono | marketing.caption / section marker |
| `.data-lg` | 20 | 22 | 600 | 0 | 1.2 | Mono | platform.data-value-lg |
| `.data-md` | 16 | 17 | 600 | 0 | 1.2 | Mono | platform.data-value-md |
| `.text-gradient-quantum` | — | — | — | — | — | — | gradient-fill text (hero words) |

### Tailwind scale (already aligned in `@theme`)

`text-xs` 12 / `text-sm` 14 / `text-base` 17 / `text-lg` 18 / `text-xl` 24 / `text-2xl` 32 / `text-3xl` 44 / `text-4xl` 56 / `text-5xl` 64.

### Hierarchy rule (NON-NEGOTIABLE)

Within any section, **child text must be smaller AND/OR lighter than its title**. Never invert. If a step description reads at 17px, its title must be ≥18px at weight 500+.

**Banned:** `font-mono text-[Npx]` with arbitrary pixel values. `text-[10px]`, `text-[11px]`, `text-[9px]`, `tracking-[0.5px]` — all forbidden.

---

## 4. Spacing, radius, shadows, layout

- **Spacing scale:** 2/4/8/12/16/20/24/32/48/64/96/128 (Tailwind default is fine — don't use arbitrary values like `p-[7px]`)
- **Radius:** `rounded-md` (6px buttons/chips), `rounded-lg` (8px cards), `rounded-xl` (12px feature cards)
- **Shadows:** borders-first; shadow only on hover. Use `shadow-elevated` on hover; NEVER `shadow-glow`. The quantum glow effect is via `.btn-quantum` hover + `:focus-visible` ring.
- **Breakpoints:** `sm:` 640, `md:` 768, `lg:` 1024, `xl:` 1280. Default responsive uses `sm:` and `md:` primarily.
- **Max content width:** `max-w-7xl` (80rem / 1280px) for listings; `max-w-3xl` for prose-heavy pages (transparency, about).

---

## 5. Interaction / hover polish (already wired in `global.css`)

These are GLOBAL — you do not need to re-implement. Just use the correct classes and they inherit.

- Nav links (inside `<header nav>`): gradient underline slides in from left on hover (inactive), static gradient bar when `.nav-active`
- `.btn-quantum`: phosphor bg + cyan+phosphor glow on hover (no transform)
- `tbody tr:hover`: phosphor inset-left + inner glow + elevated bg
- `[class*="rounded-card"]`, `article.rounded-lg`, `.card-hover`: border shifts to phosphor@35% + outer glow on hover
- `:focus-visible`: phosphor outline + outer phosphor glow
- `a` (global): 160ms color transition

**Don't add** competing transitions or per-component hover CSS — let the global rules do their job. If a card needs extra flair, add the `.card-hover` class, don't roll your own.

---

## 6. Components

### FROZEN (post-Wave 0 — DO NOT MODIFY in Wave 1)

After Wave 0 sweeps shared components, these are FROZEN for page agents:

| File | Purpose |
|------|---------|
| `src/components/Header.astro` | global nav (already DS-compliant) |
| `src/components/Footer.astro` | global footer |
| `src/components/ListingView.tsx` | listing page shell (table + cards + filters) |
| `src/components/ListingCard.astro` | listing card presentational |
| `src/components/CardGrid.tsx` | grid container |
| `src/components/DataTable.tsx` | listing table |
| `src/components/DetailPage.tsx` | detail page shell |
| `src/components/DetailHero.tsx` | detail hero |
| `src/components/DetailTabs.tsx` | detail tab UI |
| `src/components/ProductsCard.tsx` | detail products card |
| `src/components/Sources.astro` | source citations |
| `src/components/TagList.astro` | tag chips |
| `src/components/FlipCard.tsx` | flip card (used on /about) |
| `src/components/NewsletterSignup.astro` | newsletter form |
| `src/components/SearchBar.astro` | search input |
| `src/components/CustomizePanel.tsx` | customize UI |
| `src/components/DashboardGrid.tsx` | transparency dashboard grid |
| `src/styles/global.css` | global tokens + utilities |

### Page-local (Wave 1 agents may edit)

Only the `.astro` file for the page being owned, plus any page-inline `<style>` block in that file.

---

## 7. Acceptance criteria (every agent must verify)

1. **Token purity:** every color value is a CSS var / Tailwind token or the two SVG-only brand hexes (`#00E6A0`, `#00D4FF`). No raw hex. No editorial-warm leftovers (`#B45309` / `#1D4ED8`).
2. **Typography purity:** every text node uses a `.h-*` / `.body-*` / `.eyebrow*` / `.data-*` utility OR a Tailwind `text-*` class. **No `text-[Npx]` arbitrary sizes.** No `font-mono text-[9px]` style ad-hoc Plex Mono labels.
3. **Hierarchy:** within any card/section, parent size > child size (by ≥1px or ≥1 weight tier). Eyebrow < step title < section title < page hero.
4. **Contrast:** WCAG AA minimum — body text on bg ≥ 4.5:1, large/UI text ≥ 3:1. Given the token palette, this is met by default if you stick to `text-text-primary` / `text-text-secondary` / `text-text-muted` on `bg-void` / `bg-base` / `bg-surface`. Flag any token combination you're unsure about.
5. **Mobile floor:** no text under 12px (enforced by utilities); tap targets ≥ 32×32 for interactive elements (Kvantiq-relaxed from 44×44 for dense data views, but primary CTAs should be 40×40+).
6. **White-on-phosphor ban:** `bg-info` / `bg-accent` with light text is FORBIDDEN. Dark text (`text-void`) on phosphor bg only.
7. **No inline ad-hoc styles** unless explicitly required (SVG coordinates, motion transforms). If you need a color, use the token. If you need a size, use the utility.

---

## 8. Forbidden patterns

- `text-white`, `color: white`, `color: #fff` — use `text-text-primary`
- `text-[Npx]`, `tracking-[Npx]`, `leading-[Npx]` — use utilities / Tailwind tokens
- `font-mono text-[Npx] uppercase tracking-[Npx]` open-coded eyebrow — use `.eyebrow` or `.eyebrow-lg`
- `shadow-glow` class — not in the DS
- Raw hex (`#B45309`, `#1D4ED8`, `#0F766E`, any warm editorial values) — removed with the dark-mode pivot
- Per-component hover animation redefining what's in global.css — use global classes
- `bg-white` / `bg-stone-*` / `bg-amber-*` — editorial-light leftovers
- `text-3xl font-bold tracking-[-0.3px]` style ad-hoc headings — use `.h-xl` / `.h-lg`
- Modifying FROZEN components from Wave 1
- Applying `.text-gradient-quantum` to an entire H1 or full heading (see §1 H1 rule)

---

## 9. Out of scope (DO NOT TOUCH)

- Data files (`src/content/*/*.json`) — content is frozen
- Build configs (`astro.config.mjs`, `tailwind.config.*`, `package.json`)
- Routing / proxy / middleware
- Tests (`tests/`) — no test infra changes in this swarm
- `public/` assets — logo bitmaps and OG images stay
- Schemas (`src/content.config.ts`)
- Auth / forms submission logic (form styling is in scope; submission endpoints are not)
- Git hooks / CI config

---

## 10. Commands (Windows / bash)

Every agent runs these from the repo root `C:/Synapse/kvantiq-directory/`:

```bash
# Build (gate 3)
npm --prefix C:/Synapse/kvantiq-directory run build

# Typecheck — Astro's check command (gate 4)
npm --prefix C:/Synapse/kvantiq-directory run astro check
# If the project has no typecheck script, `npm run build` is sufficient (Astro builds TS-check inline)

# Dev server (already running on 4321 — DO NOT start another)
# If you need to verify a render, use curl:
curl -sI http://localhost:4321/<route>/
```

**Playwright / Chrome DevTools MCP are NOT available on Windows in this session** — gate 5 (screenshots) is **prose-only**: describe what the rendered page should show at 375 / 768 / 1440.

---

## 11. Branch + commit convention

- Branch: `ui-swarm/<page-slug>` off base `feature/kvantiq-studio-branding`
- Commit subject (Conventional Commits, ≤50 chars, no period):
  - `style(home): apply DS typography + brand tokens`
  - `style(transparency-audit): migrate to DS utilities`
- Commit body: 72-char wrap, explain WHY (DS v1.1 rollout — alpha push)
- Co-author line: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- One commit per agent when possible; if the agent splits work, each commit is atomic and passes gates independently

---

## 12. Done criteria

An agent's PR is ready when:

- [ ] All gates 1-5 pass (5 may be prose-only)
- [ ] Token audit lists zero raw hex outside SVG brand stops, or justifies each one inline
- [ ] No inversion of hierarchy in any section
- [ ] Diff is limited to the agent's scope (page file + any page-local style block only)
- [ ] Dev server at `localhost:4321/<route>/` returns 200 with no console errors
- [ ] Final report matches the return template in the agent prompt
