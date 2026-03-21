# Kvantiq Directory UI Redesign — Design Specification

**Date:** 2026-03-20
**Scope:** Detail pages, listing pages, customizable grid, news data model, weekly AI sweep, light theme
**Out of scope:** Content changes, deployment changes, new collections

---

## 1. Design System: Quantum Phosphor

All UI must use the existing Quantum Phosphor design system. Source: Paper.design file `01KKNN521ARMBW56P2X30GH3CZ`.

### Color Tokens (Dark Theme — Primary)

| Token | Value | Usage |
|-------|-------|-------|
| `--void` | `#06090F` | Page background |
| `--base` | `#0B1120` | Card/section backgrounds |
| `--surface` | `#111827` | Elevated cards, inputs |
| `--elevated` | `#1E293B` | Hover states, stat boxes |
| `--border` | `#1F2937` | All borders |
| `--text-primary` | `#E2E8F0` | Headings, body text |
| `--text-secondary` | `#94A3B8` | Descriptions, labels |
| `--text-muted` | `#64748B` | Timestamps, meta |
| `--accent` | `#00FFB2` | Primary accent (phosphor) |
| `--accent-hover` | `#00E6A0` | Hover state |
| `--accent-glow` | `rgba(0,255,178,0.12)` | Subtle bg glow — USE SPARINGLY |
| `--info` | `#60A5FA` | Info badges, benchmark color |
| `--warning` | `#FFAA00` | Warning, company badge color |
| `--error` | `#FF4C4C` | Error states |

### Light Theme (BLOCKED — design in Paper.design first)

**PREREQUISITE:** The light theme palette MUST be designed in Paper.design BEFORE any implementation begins. Do NOT guess colors or invent a light palette — wait for the approved design.

A light theme variant is required for users who prefer light mode. Constraints:
- Must maintain the same layout and component structure as dark theme
- Toggle via system preference (`prefers-color-scheme`) + manual override saved to localStorage
- Accent color stays `#00FFB2` (or an adjusted variant that works on light backgrounds)
- Design the light palette in Paper.design before implementing
- Fonts, spacing, and component shapes remain identical
- **Implementation order:** Light theme is the LAST item implemented. All other work uses dark theme only.

### Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| H1 (page titles) | Inter Tight | Bold (700) | 32px, tracking -0.02em |
| H2 (section heads) | Inter Tight | SemiBold (600) | 24px |
| Card titles (OVERVIEW, LATEST NEWS, etc.) | IBM Plex Mono | SemiBold (600) | 13px, uppercase, tracking 0.08em, color: `--text-primary` (NOT muted) |
| Body text | Inter | Regular (400) | 15px, line-height 1.7 |
| Descriptions | Inter | Regular (400) | 14px, color: `--text-secondary` |
| News headlines | Inter | Medium (500) | 16px |
| Meta/timestamps | IBM Plex Mono | Regular (400) | 12px (NOT 10px) |
| Tags/badges | IBM Plex Mono | Medium (500) | 11px |
| Code/terminal | IBM Plex Mono | Regular (400) | 13px |

**Key refinement:** Card section titles (OVERVIEW, LATEST NEWS, RELATED, SOURCES) use IBM Plex Mono SemiBold at 13px in `--text-primary` — NOT muted. They must be clearly readable and brighter than surrounding content.

### Motion & Micro-interactions

Use Framer Motion (already installed). All durations and springs from the Quantum Phosphor spec:

| Duration | Value | Usage |
|----------|-------|-------|
| Instant | 80ms | Toggles, checkboxes |
| Fast | 120ms | Button hover/active, tooltip |
| Standard | 200ms | Card hover lift, input focus |
| Dramatic | 400ms | Modal enter/exit, page transitions |

| Spring | Config | Usage |
|--------|--------|-------|
| Snappy | stiffness: 400, damping: 30 | Card hover, button press |
| Bouncy | stiffness: 300, damping: 20 | Success states |
| Gentle | stiffness: 150, damping: 25 | Scroll reveals, page entrance |

**Glow effect:** REDUCED from original spec. Use phosphor glow ONLY on:
- Active/focused elements (not resting state)
- Primary CTA buttons on hover
- Active tab indicator

Do NOT apply glow to: card borders on hover (use subtle border-color shift instead), card titles, or body text. The glow is earned through interaction, not decorative.

### Spacing

All cards must have generous padding for readability:
- Card padding: 24px (desktop), 20px (mobile)
- Between news items: 16px padding + 1px border separator
- Between cards in grid: 16px gap
- Between card title and content: 16px

---

## 2. Detail Pages (Company, Benchmark, Use Case, Challenge)

### Structure

```
┌──────────────────────────────────────┐
│  Hero Card (full width)              │
│  - Type label, name, meta, tags      │
│  - Stats (employees, funding, etc.)  │
│  - CTA buttons (website, sources)    │
├──────────────────────────────────────┤
│  Tab Bar                             │
│  Overview | Latest News | Related | Sources | ⚙ Customize │
├──────────────────────────────────────┤
│  Tab Content Area                    │
│  (changes based on active tab)       │
└──────────────────────────────────────┘
```

### Hero Card

- Full-width dark gradient card (`--base` → `--surface`)
- Subtle radial accent glow in top-right corner (very faint, decorative only)
- Left: type label (IBM Plex Mono, accent color), name (Inter Tight Bold 32px), meta line, tags, CTA buttons
- Right: stat boxes in `--elevated` background with `--border`
- CTA: primary button uses phosphor gradient (`#00FFB2` → `#00D4FF`), secondary button uses border style
- Hero is NOT customizable — it's always present

### Tab Bar

Tabs are **rich subpages**, not scroll anchors. Each tab replaces the entire content area below.

- Container: `--base` background, `--border` border, 12px radius, 4px padding
- Inactive tab: `--text-muted` color
- Active tab: `--accent` color, `--surface` background, subtle glow shadow (`0 0 12px rgba(0,255,178,0.08)`)
- Customize button at far right (⚙ icon + text)
- Mobile: horizontal scroll, same styling

### Tab: Overview (default)

The Overview tab shows a **customizable dashboard grid** powered by `react-grid-layout`.

**Default cards (all visible):**

| Card | Default Size | Content |
|------|-------------|---------|
| Overview | Full width | Company/benchmark description (15px body text) |
| Latest News | Half width | 2-3 headline items with date + source link |
| Key Metrics | Half width | Grid of stat boxes (value + label) |
| Related | Half width | Cross-linked items with color-coded type badges |
| Sources | Full width | Citation list with icons, titles, access dates |

**Customization (via ⚙ panel):**
- Slide-in panel from right
- Toggle cards on/off
- Set card size: half width or full width
- Drag to reorder (drag handle: ⁞⁞ dots in card header)
- Layout saved to `localStorage` (key: `kvantiq-layout-{collection}-default` — shared across all items in a collection, NOT per-slug)
- "Reset to default" button

**Desktop:** 2-column grid, cards can span 1 or 2 columns
**Mobile:** Single column, all cards stack. Drag-to-reorder works via long-press.

### Tab: Latest News

Full-width rich article cards. Each news item gets its own card with:
- Headline: Inter Medium 16px, `--text-primary`
- Excerpt: Inter Regular 14px, `--text-secondary`, line-height 1.7
- Meta bar: IBM Plex Mono 12px — date + source link (accent color)
- Padding between items: 16px
- Header: item count + "Updated weekly via AI sweep" in IBM Plex Mono 12px muted

### Tab: Related

Grid of related items, each as a mini-card:
- Type badge (color-coded): Benchmark (info/blue), Use Case (accent/green), Company (warning/amber), Challenge (error/red), Resource (muted)
- Item name, 1-line description
- Click navigates to that item's detail page

**How related items are determined:** Tag-based matching. An item is "related" if it shares **2 or more tags** with the current entry, across ALL collections. No new schema fields needed — the matching is computed at build time from existing `tags` arrays.

**Where the logic runs:** Tag matching runs in the `.astro` page at build time (inside `getStaticPaths` or the page frontmatter). The pre-computed related items list is passed as a prop to `DetailTabs.tsx` — the React component does NOT query the collection itself.

- Maximum 6 related items shown (prioritize: same collection first, then other collections)
- If fewer than 2 matches exist, the Related tab is hidden (same rule as Latest News)
- The Related card on the Overview tab shows the top 3 matches only

### Tab: Sources

Detailed citation cards:
- Source icon + linked title (accent color)
- Meta line: type + access date (IBM Plex Mono 12px)
- 2-column layout on desktop, single column on mobile

### FAQ

**REMOVED.** No FAQ section on any page.

---

## 3. Listing Pages (Companies, Benchmarks, Use Cases, Challenges, Resources)

### Current State (Problems)

- Plain HTML table + card grid dump
- No interactive filtering
- No sort indicators
- No visual hierarchy between sections
- Cards are generic and don't show enough information

### Redesigned Listing Page Structure

```
┌──────────────────────────────────────┐
│  Page Header                         │
│  - Title (Inter Tight Bold 32px)     │
│  - Subtitle with count               │
├──────────────────────────────────────┤
│  Filter/Sort Toolbar                 │
│  [Filter ▾] [Sort ▾] [View: ☐ ☰]   │
├──────────────────────────────────────┤
│  Interactive DataTable               │
│  - Sortable columns (click headers)  │
│  - Sort icon (▲▼) on active column   │
│  - Filter dropdowns per column       │
│  - Hover row highlight               │
├──────────────────────────────────────┤
│  OR Card Grid (toggle view)          │
│  - Richer cards with more metadata   │
└──────────────────────────────────────┘
```

### Filter/Sort Toolbar

- Background: `--base`, border: `--border`, rounded
- Filter dropdowns: by country, region, type, category (varies by collection)
- Sort dropdown: by name, founded date, funding, etc.
- View toggle: table view (default) or card grid
- Active filters shown as removable pills (accent background)
- Filter/sort icons: monospace chevrons (▾ for dropdown, ▲▼ for sort direction)

### DataTable Enhancements

**IMPORTANT:** The existing `src/components/DataTable.tsx` already implements: sort icons (▲▼), column-level filter dropdowns, global search, URL state persistence, row-click navigation, result counts, and a "clear all" button. **Do NOT rebuild this component.** The work here is:

1. **Token update only** — replace hardcoded light-theme colors with Quantum Phosphor CSS variables:
   - `#E8E6E1` borders → `var(--border)`
   - `#E8E6E1` inactive sort arrow text (lines 223-224) → `var(--text-muted)` (NOT `var(--border)` — this is text, not a border, and must remain visible on dark backgrounds)
   - `#2563EB` links/active sort → `var(--accent)`
   - `#F0EEE9` row borders → `var(--border)`
   - `#8A8A8A` muted text → `var(--text-muted)`
   - `#1a1a1a` text → `var(--text-primary)`
   - `#5A5A5A` cell text → `var(--text-secondary)`
   - `#FECACA` "Clear filters" hover border → `var(--error)` at 30% opacity
   - `#DC2626` "Clear filters" hover text → `var(--error)`
   - `#BFDBFE` focus ring/border on inputs and selects → `focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-glow)]`
   - White backgrounds (`bg-white`) → `var(--surface)` for inputs, `var(--base)` for containers
2. **Add sticky header** — `position: sticky; top: 0; z-index: 10` on `<thead>`
3. **Add row hover** — `hover:bg-[var(--elevated)]` on `<tr>`

**`FilterToolbar.tsx` is NOT needed** — DataTable already contains its own filter bar. If a separate toolbar wrapper is desired later for view-toggle (table/card), it can wrap DataTable, not replace it.

### Card Grid Enhancements

Richer cards showing:
- Company: name, country, type, founded, funding, 1-line description, tags (first 3)
- Benchmark: name, algorithm, category, qubits, reproducible badge
- Use case: name, industry, category, 1-line problem statement
- Challenge: name, organizer, status badge (upcoming/active/completed), date
- Resource: name, type, provider, open-source badge

---

## 4. News Data Model

### Schema Addition

Add `news` array to all collection schemas in `content.config.ts`:

```typescript
const newsSchema = z.object({
  title: z.string(),
  excerpt: z.string().optional(),
  url: z.string().url(),
  source: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be ISO 8601 format: YYYY-MM-DD'),
});

// Add to each collection schema:
news: z.array(newsSchema).default([]),
```

### Population

News data is populated by the weekly AI sweep GitHub Action (see section 5). The `news` field is optional and defaults to empty.

### Empty News Handling

- Entries with `news: []` (empty or default): the "Latest News" tab is **hidden** from the tab bar. The Overview tab's news card is also hidden.
- Entries with 1+ news items: tab and card appear normally.
- This means the tab bar is NOT fixed — it adjusts per entry based on available data. This is acceptable because users browse one entry at a time.

---

## 5. Weekly AI Sweep (GitHub Action)

### Purpose

Automated weekly content freshness check using Claude API. Creates a PR with updates for human review.

### Workflow: `.github/workflows/ai-sweep.yml`

- **Trigger:** Weekly cron (Sunday 00:00 UTC) + manual dispatch
- **Steps:**
  1. Checkout repo
  2. Run Node.js script that calls Claude API for each collection
  3. Claude researches: new funding rounds, product launches, leadership changes, new papers
  4. Script updates JSON files with new `news` items, updated descriptions where warranted
  5. Run `npm run build` to validate
  6. If changes exist, create a PR using `peter-evans/create-pull-request` action
  7. PR uses the standard template, tagged `ai-sweep` for filtering
- **Secrets required:** `ANTHROPIC_API_KEY`
- **Cost estimate:** ~$1-3/month (183 entries × ~500 tokens each × 4 weeks)

### Sweep Script: `scripts/ai-sweep.mjs`

**CRITICAL: Hallucination prevention.** The Claude API does not browse the web. If asked to "research" an entity from memory, it WILL fabricate plausible-sounding news (funding rounds that didn't happen, partnerships that don't exist). This is unacceptable for a directory that mandates factual, sourced content.

**The sweep uses a fetch-first, extract-second approach:**

For each entry:
1. Read current JSON (get name, website, source URLs)
2. **Fetch real content** from the entry's source URLs and website:
   - HTTP GET each source URL and the company website
   - Extract text content (strip HTML tags)
   - If ALL fetches fail (timeouts, 403s, etc.), **skip this entry entirely** — do not guess
3. Send fetched content + current JSON to Claude with this instruction:
   ```
   You are given the current directory entry and freshly fetched content from its source URLs.
   Extract ONLY news items that are explicitly stated in the provided content.
   Do NOT invent, infer, or recall information from your training data.
   If the fetched content contains no news, return an empty news array.
   Each news item MUST include a direct URL to the source page where you found it.
   Date format: YYYY-MM-DD. If exact date is unclear, use the first of the month.
   ```
4. Validate Claude's response: every `url` in the returned news must match one of the fetched source domains. Discard any item with an unrecognized URL.
5. Merge validated news into JSON (never delete existing fields, only add/update)
6. Write updated JSON

### Constraints

- The sweep NEVER removes sources or existing data
- The sweep NEVER fabricates news — it only extracts from fetched content
- News items with URLs that don't match fetched sources are DISCARDED
- News items older than 6 months are automatically pruned
- Maximum 5 news items per entry
- Entries where all fetches fail are skipped with a warning in the PR body
- The sweep creates a single PR for all changes across all collections
- PR body includes a summary table: entries updated, entries skipped, items added/pruned

---

## 6. Customizable Grid (react-grid-layout)

### Library

`react-grid-layout` — already compatible with React 19 (installed in project).

### Implementation

Each detail page renders a `<ResponsiveGridLayout>` component:
- Breakpoints: `lg: 1100, md: 768, sm: 480`
- Columns: `lg: 2, md: 2, sm: 1`
- Row height: auto-sized based on content
- Drag handles: `.card-drag` element in card header
- Resize: enabled on desktop, disabled on mobile

### Layout Persistence

```typescript
// Key format: kvantiq-layout-{collection}-default
// (same layout for all items in a collection, not per-item)
const layoutKey = `kvantiq-layout-${collection}-default`;

// Save on layout change
const onLayoutChange = (layout) => {
  localStorage.setItem(layoutKey, JSON.stringify(layout));
};

// Load on mount
const savedLayout = JSON.parse(localStorage.getItem(layoutKey) || 'null');
```

### Customize Panel

Slide-in panel from right edge, 320px wide:
- Background: `--surface`, border-left: `--border`
- Header: "Customize Layout" (Inter Tight SemiBold 16px)
- Subtitle: "Toggle, resize, and drag cards. Saved automatically." (Inter 13px, secondary)
- Card list: toggle switches (ON/OFF) with drag handles for reorder
- Card size selector: Half | Full width
- Reset button at bottom
- Close on: click outside, press Escape, click Done

---

## 7. Implementation Notes

### Component Changes

| File | Change |
|------|--------|
| `src/pages/companies/[slug].astro` | Replace with new hero + tab layout |
| `src/pages/benchmarks/[slug].astro` | Same pattern as companies |
| `src/pages/use-cases/[slug].astro` | Same pattern |
| `src/pages/challenges/[slug].astro` | Same pattern |
| `src/pages/companies/index.astro` | Add filter toolbar, sort icons |
| `src/pages/benchmarks/index.astro` | Same |
| `src/pages/use-cases/index.astro` | Same |
| `src/pages/challenges/index.astro` | Same |
| `src/pages/resources/index.astro` | Same |
| `src/content.config.ts` | Add `news` schema to all collections |
| `src/components/DetailHero.tsx` | NEW — shared hero component |
| `src/components/DetailTabs.tsx` | NEW — tab bar + content switching |
| `src/components/DashboardGrid.tsx` | NEW — react-grid-layout wrapper |
| `src/components/CustomizePanel.tsx` | NEW — slide-in settings panel |
| `src/components/DataTable.tsx` | Token update — replace hardcoded colors with CSS variables |
| `src/styles/global.css` | Add Quantum Phosphor CSS variables |
| `.github/workflows/ai-sweep.yml` | NEW — weekly sweep action |
| `scripts/ai-sweep.mjs` | NEW — sweep script |

### Dependencies to Add

- `react-grid-layout` — customizable grid
  - **CSS import required:** `react-grid-layout/css/styles.css` and `react-resizable/css/styles.css` must be imported in the `DashboardGrid.tsx` component. With Tailwind CSS 4 via `@tailwindcss/vite`, these CSS files are handled as standard Vite CSS imports — import them at the top of the component file.
- `@anthropic-ai/sdk` — for AI sweep script (devDependency only, not bundled in browser)

### Migration

The redesign replaces existing page templates. No backwards compatibility needed — the current templates are simple enough to replace entirely.

### Light Theme

Design the light theme palette in Paper.design BEFORE implementing. Implementation approach:
- CSS custom properties switch based on `data-theme="light"` on `<html>`
- Toggle stored in localStorage
- System preference detection via `prefers-color-scheme`
- A small theme toggle component in the header

---

## 8. Implementation Order

Execute in this order. Each step must build and pass CI before moving to the next.

1. **Quantum Phosphor token update** — `global.css` CSS variables + `BaseLayout.astro` theme class
2. **News schema addition** — `content.config.ts` (all collections get `news` field)
3. **DataTable token update** — replace hardcoded colors in `DataTable.tsx`
4. **Detail page: Hero + Tabs** — `DetailHero.tsx`, `DetailTabs.tsx`, update all `[slug].astro` pages
5. **Detail page: Dashboard Grid** — `DashboardGrid.tsx`, `CustomizePanel.tsx`, `react-grid-layout` integration
6. **Listing page card grid** — richer cards with view toggle (table/card)
7. **AI sweep script** — `scripts/ai-sweep.mjs` + `.github/workflows/ai-sweep.yml`
8. **Light theme** — BLOCKED until Paper.design palette is finalized

### Note on Resources

Resources (`/resources/`) only have an index page — they link out to external sites and have no detail page. The detail page redesign (steps 4-5) does NOT apply to resources. The listing page update (steps 3, 6) does apply.

---

## 9. What's NOT Included

- New content types or collections
- Authentication or user accounts
- Server-side rendering (stays static)
- Comment/rating system
- Multi-language support
