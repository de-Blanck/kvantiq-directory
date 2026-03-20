# Kvantiq Directory UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the directory's detail pages (hero + tab subpages + customizable grid), update listing pages to Quantum Phosphor dark theme, add news data model, and build a weekly AI content sweep.

**Architecture:** Replace existing light-theme Astro pages with dark-native Quantum Phosphor design. Detail pages become React islands with hero card, tab navigation, and draggable dashboard grid (`react-grid-layout`). Listing pages keep the existing `DataTable.tsx` but get a token update + card grid view toggle. A weekly GitHub Action fetches source URLs and uses Claude API to extract news items into a PR.

**Tech Stack:** Astro 6, React 19, Tailwind CSS 4 (`@tailwindcss/vite`), `@tanstack/react-table`, `react-grid-layout`, `framer-motion`, `@anthropic-ai/sdk`

**Spec:** `docs/superpowers/specs/2026-03-20-ui-redesign-design.md`

**Working directory:** `E:\kvantiq-directory\.worktrees\feature-directory-site\`

---

## File Structure

### New Files

```
src/components/DetailHero.tsx          — Hero card component (shared across all detail pages)
src/components/DetailTabs.tsx          — Tab bar + content area switcher
src/components/DashboardGrid.tsx       — react-grid-layout wrapper for Overview tab
src/components/CustomizePanel.tsx      — Slide-in settings panel for grid customization
src/components/DetailPage.tsx          — Orchestrator: wires hero, tabs, grid together
src/components/CardGrid.tsx            — Rich card grid view for listing pages
src/components/ViewToggle.tsx          — Table/card view switcher for listing pages
src/lib/related.ts                     — Build-time tag matching utility
scripts/ai-sweep.mjs                   — Weekly content sweep script
.github/workflows/ai-sweep.yml         — Weekly cron workflow
```

### Modified Files

```
src/styles/global.css                   — Replace light tokens with Quantum Phosphor dark tokens
src/layouts/BaseLayout.astro            — Add Inter Tight font import, dark body classes
src/content.config.ts                   — Add newsSchema + news field to all collections
src/components/DataTable.tsx            — Replace 12 hardcoded colors with CSS variable tokens
src/pages/companies/[slug].astro        — Replace with hero + tabs layout
src/pages/benchmarks/[slug].astro       — Same
src/pages/use-cases/[slug].astro        — Same
src/pages/challenges/[slug].astro       — Same
src/pages/companies/index.astro         — Add view toggle (table/card)
src/pages/benchmarks/index.astro        — Same
src/pages/use-cases/index.astro         — Same
src/pages/challenges/index.astro        — Same
src/pages/resources/index.astro         — Token update only (no detail pages)
src/pages/index.astro                   — Token update for homepage
src/pages/about.astro                   — Token update
src/pages/404.astro                     — Token update
src/components/Header.astro             — Dark theme token update
src/components/Footer.astro             — Dark theme token update
src/components/ListingCard.astro        — Dark theme token update
src/components/NewsletterSignup.astro   — Dark theme token update
src/components/SearchBar.astro          — Dark theme token update
```

---

## Task 1: Quantum Phosphor Token Update

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Replace global.css with Quantum Phosphor tokens**

Replace the entire `@theme` block in `src/styles/global.css` with Quantum Phosphor dark tokens. Keep the `@import "tailwindcss"` and body/table styles, updating them to use new tokens.

```css
@import "tailwindcss";

@theme {
  /* Quantum Phosphor — Dark Theme */
  --color-void: #06090F;
  --color-base: #0B1120;
  --color-surface: #111827;
  --color-elevated: #1E293B;
  --color-border: #1F2937;

  --color-text-primary: #E2E8F0;
  --color-text-secondary: #94A3B8;
  --color-text-muted: #64748B;

  --color-accent: #00FFB2;
  --color-accent-hover: #00E6A0;
  --color-accent-glow: rgba(0, 255, 178, 0.12);
  --color-cyan: #00D4FF;

  --color-info: #60A5FA;
  --color-warn: #FFAA00;
  --color-error: #FF4C4C;

  /* Typography */
  --font-family-heading: 'Inter Tight', system-ui, sans-serif;
  --font-family-body: 'Inter', system-ui, sans-serif;
  --font-family-mono: 'IBM Plex Mono', monospace;

  /* Shadows */
  --shadow-subtle: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-elevated: 0 2px 8px rgba(0, 0, 0, 0.4);
  --shadow-glow: 0 0 12px rgba(0, 255, 178, 0.08);
}

body {
  font-family: var(--font-family-body);
  background-color: var(--color-void);
  color: var(--color-text-primary);
}

tbody tr {
  transition: background-color 80ms ease-out;
}
tbody tr:hover {
  background-color: var(--color-elevated);
}
```

- [ ] **Step 2: Update BaseLayout.astro font imports**

In `src/layouts/BaseLayout.astro`, replace the Google Fonts link to include Inter Tight (for headings) and Inter (for body), keeping IBM Plex Mono:

```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter+Tight:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
```

Also update the `<body>` class:

```html
<body class="min-h-screen bg-void text-text-primary">
```

- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`
Expected: Build succeeds. Site now renders with dark background.

- [ ] **Step 4: Visual verification**

Run dev server and take a Playwright screenshot to confirm dark theme applies:
```bash
npm run dev &
```
Take screenshot at `http://localhost:4321/` — should show dark background, light text.

- [ ] **Step 5: Commit**

```bash
git add src/styles/global.css src/layouts/BaseLayout.astro
git commit -m "feat: apply Quantum Phosphor dark theme tokens"
```

---

## Task 2: News Schema Addition

**Files:**
- Modify: `src/content.config.ts`

**NOTE:** This must run early because later tasks (Detail Page components) reference `entry.news` which requires the schema to exist for TypeScript types.

- [ ] **Step 1: Add newsSchema and update all collections**

In `src/content.config.ts`, add the news schema after `sourceSchema`:

```typescript
const newsSchema = z.object({
  title: z.string(),
  excerpt: z.string().optional(),
  url: z.string().url(),
  source: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be ISO 8601 format: YYYY-MM-DD'),
});
```

Add `news: z.array(newsSchema).default([]),` to ALL 5 collection schemas (companies, benchmarks, useCases, challenges, resources) — place it after the `sources` field in each.

- [ ] **Step 2: Build-validate**

Run: `npm run build`
Expected: Build succeeds. All 183 entries pass validation (news defaults to `[]`).

- [ ] **Step 3: Commit**

```bash
git add src/content.config.ts
git commit -m "feat: add news schema to all content collections"
```

---

## Task 3: Update Shell Components (Header, Footer, etc.)

**Files:**
- Modify: `src/components/Header.astro`
- Modify: `src/components/Footer.astro`
- Modify: `src/components/ListingCard.astro`
- Modify: `src/components/NewsletterSignup.astro`
- Modify: `src/components/SearchBar.astro`
- Modify: `src/components/TagList.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/about.astro`
- Modify: `src/pages/404.astro`

- [ ] **Step 1: Read each file listed above**

Read every file to understand current classes and colors.

- [ ] **Step 2: Update Header.astro**

Replace all light-theme Tailwind classes with Quantum Phosphor tokens:
- `bg-white` → `bg-base`
- `border-gray-200` → `border-border`
- `text-indigo-700` → `text-accent`
- `text-gray-600` → `text-text-secondary`
- `hover:text-gray-900` → `hover:text-text-primary`
- `bg-indigo-700` → background gradient `bg-gradient-to-r from-accent to-cyan`
- `text-white` on CTA → `text-void`
- `hover:bg-indigo-800` → `hover:bg-accent-hover`

- [ ] **Step 3: Update Footer.astro**

Replace light classes:
- `bg-gray-50` → `bg-base`
- `border-gray-200` → `border-border`
- `text-gray-500` → `text-text-muted`
- `hover:text-gray-700` → `hover:text-text-secondary`

- [ ] **Step 4: Update ListingCard.astro**

- `border-gray-200` → `border-border`
- `bg-indigo-50/30` (featured) → `bg-accent-glow`
- `border-indigo-300` (featured) → `border-accent/20`
- `text-gray-900` → `text-text-primary`
- `text-gray-500` → `text-text-muted`
- `text-gray-600` → `text-text-secondary`
- `bg-indigo-100` → `bg-accent-glow`
- `text-indigo-800` → `text-accent`
- `hover:shadow-md` → `hover:border-accent/20 hover:shadow-glow`

- [ ] **Step 5: Update remaining components**

Apply the same token pattern to `NewsletterSignup.astro`, `SearchBar.astro`, `TagList.astro`.

- [ ] **Step 6: Update pages (index.astro, about.astro, 404.astro)**

Replace all hardcoded light-theme colors in these pages with Quantum Phosphor tokens. Read each page first to understand the current classes.

- [ ] **Step 7: Build-validate**

Run: `npm run build`
Expected: Build succeeds. No hardcoded light-theme colors remain in modified files.

- [ ] **Step 8: Visual verification**

Take Playwright screenshots of homepage, about, and 404 pages at desktop (1280x800) and mobile (375x812). All should render with dark background, phosphor accents.

- [ ] **Step 9: Commit**

```bash
git add src/components/Header.astro src/components/Footer.astro src/components/ListingCard.astro src/components/NewsletterSignup.astro src/components/SearchBar.astro src/components/TagList.astro src/pages/index.astro src/pages/about.astro src/pages/404.astro
git commit -m "feat: update shell components and static pages to Quantum Phosphor"
```

---

## Task 4: DataTable Token Update

**Files:**
- Modify: `src/components/DataTable.tsx`

- [ ] **Step 1: Read DataTable.tsx**

Read `src/components/DataTable.tsx` to confirm current hardcoded colors.

- [ ] **Step 2: Replace all hardcoded colors**

Apply these exact replacements (use find-and-replace):

| Find | Replace |
|------|---------|
| `text-[#2563EB]` | `text-accent` |
| `border-[#E8E6E1]` | `border-border` |
| `bg-white` | `bg-surface` |
| `text-[#1a1a1a]` | `text-text-primary` |
| `placeholder-[#8A8A8A]` | `placeholder-text-muted` |
| `text-[#8A8A8A]` | `text-text-muted` |
| `text-[#5A5A5A]` | `text-text-secondary` |
| `border-[#F0EEE9]` | `border-border` |
| `focus:border-[#BFDBFE]` | `focus:border-accent` |
| `focus:ring-[#BFDBFE]` | `focus:ring-accent-glow` |
| `hover:border-[#FECACA]` | `hover:border-error/30` |
| `hover:text-[#DC2626]` | `hover:text-error` |
| `hover:text-[#1a1a1a]` | `hover:text-text-primary` |

For sort arrows (lines 223-224), the inactive `text-[#E8E6E1]` must become `text-text-muted` (NOT `text-border`):
```tsx
<span className={sorted === 'asc' ? 'text-accent' : 'text-text-muted'}>▲</span>
<span className={sorted === 'desc' ? 'text-accent' : 'text-text-muted'}>▼</span>
```

- [ ] **Step 3: Add sticky header**

Add `sticky top-0 z-10 bg-void` to the `<thead>` element:

```tsx
<thead className="sticky top-0 z-10 bg-void">
```

- [ ] **Step 4: Add row hover**

Add hover class to table rows:

```tsx
className="border-b border-border cursor-pointer hover:bg-elevated transition-colors duration-75"
```

- [ ] **Step 5: Build-validate**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Visual verification**

Take screenshot of `/companies/` page. Table should show dark theme with phosphor accent on links and sort icons.

- [ ] **Step 7: Commit**

```bash
git add src/components/DataTable.tsx
git commit -m "feat: update DataTable to Quantum Phosphor tokens"
```

---

## Task 5: Related Items Utility

**Files:**
- Create: `src/lib/related.ts`

- [ ] **Step 1: Create the tag-matching utility**

Create `src/lib/related.ts`:

```typescript
export interface RelatedItem {
  slug: string;
  name: string;
  description: string;
  collection: string;
  tags: string[];
  href: string;
}

/**
 * Find related items across all collections by shared tags.
 * An item is "related" if it shares 2+ tags with the current entry.
 * Runs at build time in .astro pages — do NOT import in React components.
 */
export function findRelated(
  currentSlug: string,
  currentTags: string[],
  allItems: RelatedItem[],
  maxItems = 6
): RelatedItem[] {
  const tagSet = new Set(currentTags);

  return allItems
    .filter(item => item.slug !== currentSlug)
    .map(item => ({
      ...item,
      sharedCount: item.tags.filter(t => tagSet.has(t)).length,
    }))
    .filter(item => item.sharedCount >= 2)
    .sort((a, b) => b.sharedCount - a.sharedCount)
    .slice(0, maxItems);
}
```

- [ ] **Step 2: Build-validate**

Run: `npm run build`
Expected: Build succeeds. File is importable.

- [ ] **Step 3: Commit**

```bash
git add src/lib/related.ts
git commit -m "feat: add tag-based related items utility"
```

---

## Task 6: Detail Page Hero Component

**Files:**
- Create: `src/components/DetailHero.tsx`

- [ ] **Step 1: Create DetailHero.tsx**

Create `src/components/DetailHero.tsx` — a React component that renders the hero card for any content type:

```tsx
import { motion } from 'framer-motion';

interface HeroStat {
  value: string;
  label: string;
}

interface DetailHeroProps {
  type: string;         // "Company", "Benchmark", etc.
  name: string;
  meta: string;         // "Austria · Software · Founded 2020"
  description: string;
  tags: string[];
  stats: HeroStat[];
  websiteUrl?: string;
  websiteLabel?: string;
  sourceCount: number;
}

export default function DetailHero({
  type, name, meta, description, tags, stats, websiteUrl, websiteLabel, sourceCount
}: DetailHeroProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-base to-surface p-7 mb-4"
    >
      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/[0.03] blur-3xl" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:justify-between lg:items-start">
        {/* Left: identity */}
        <div className="flex-1">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-accent">
            {type}
          </div>
          <h1 className="mt-1 font-heading text-[32px] font-bold leading-tight tracking-[-0.02em] text-text-primary">
            {name}
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">{meta}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map(tag => (
              <span
                key={tag}
                className="rounded-full border border-accent/20 bg-accent-glow px-3 py-1 font-mono text-[11px] text-text-secondary"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-accent to-cyan px-5 py-2 text-[13px] font-semibold text-void transition-opacity hover:opacity-90"
              >
                ↗ {websiteLabel || 'Visit Website'}
              </a>
            )}
            <a
              href="#sources"
              className="inline-flex items-center rounded-lg border border-border px-5 py-2 text-[13px] font-medium text-text-secondary transition-colors hover:border-text-muted"
            >
              Sources ({sourceCount})
            </a>
          </div>
        </div>

        {/* Right: stats */}
        {stats.length > 0 && (
          <div className="flex gap-3 lg:gap-4">
            {stats.map(stat => (
              <div
                key={stat.label}
                className="rounded-xl border border-border bg-elevated px-5 py-3 text-center min-w-[100px]"
              >
                <div className="font-heading text-xl font-bold text-text-primary">{stat.value}</div>
                <div className="mt-0.5 font-mono text-[10px] text-text-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Build-validate**

Run: `npm run build`
Expected: Build succeeds. Component compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/DetailHero.tsx
git commit -m "feat: add DetailHero component"
```

---

## Task 7: Detail Page Tabs Component

**Files:**
- Create: `src/components/DetailTabs.tsx`

- [ ] **Step 1: Create DetailTabs.tsx**

Create `src/components/DetailTabs.tsx` — manages tab state and renders tab content:

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RelatedItem } from '../lib/related';

interface NewsItem {
  title: string;
  excerpt?: string;
  url: string;
  source: string;
  date: string;
}

interface SourceItem {
  type: string;
  url: string;
  title?: string;
  dateAccessed?: string;
}

interface DetailTabsProps {
  /** React node for the Overview tab content (DashboardGrid) */
  children: React.ReactNode;
  news: NewsItem[];
  related: RelatedItem[];
  sources: SourceItem[];
  onCustomize: () => void;
}

type TabId = 'overview' | 'news' | 'related' | 'sources';

export default function DetailTabs({ children, news, related, sources, onCustomize }: DetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Build tab list — hide tabs with no data
  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(news.length > 0 ? [{ id: 'news' as TabId, label: 'Latest News' }] : []),
    ...(related.length >= 2 ? [{ id: 'related' as TabId, label: 'Related' }] : []),
    { id: 'sources', label: 'Sources' },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center rounded-xl border border-border bg-base p-1 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-5 py-2.5 text-[13px] font-medium transition-all duration-120 ${
              activeTab === tab.id
                ? 'bg-surface text-accent shadow-glow'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={onCustomize}
          className="flex items-center gap-1.5 px-4 py-2.5 font-mono text-[11px] text-text-muted hover:text-text-secondary transition-colors"
        >
          ⚙ Customize
        </button>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && children}

          {activeTab === 'news' && (
            <div className="flex flex-col gap-3">
              <div className="font-mono text-[12px] text-text-muted mb-1">
                {news.length} article{news.length !== 1 ? 's' : ''} · Updated weekly via AI sweep
              </div>
              {news.map((item, i) => (
                <a
                  key={i}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-border bg-surface p-6 transition-colors hover:border-accent/20"
                >
                  <div className="text-[16px] font-medium text-text-primary mb-1.5">{item.title}</div>
                  {item.excerpt && (
                    <div className="text-[14px] text-text-secondary leading-[1.7] mb-3">{item.excerpt}</div>
                  )}
                  <div className="flex gap-2 font-mono text-[12px] text-text-muted">
                    <span>📅 {item.date}</span>
                    <span>·</span>
                    <span className="text-accent">{item.source} ↗</span>
                  </div>
                </a>
              ))}
            </div>
          )}

          {activeTab === 'related' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {related.map(item => (
                <a
                  key={item.slug}
                  href={item.href}
                  className="flex items-start gap-3 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/20"
                >
                  <span className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                    item.collection === 'benchmarks' ? 'bg-info/15 text-info' :
                    item.collection === 'use-cases' ? 'bg-accent-glow text-accent' :
                    item.collection === 'companies' ? 'bg-warn/15 text-warn' :
                    item.collection === 'challenges' ? 'bg-error/15 text-error' :
                    'bg-elevated text-text-muted'
                  }`}>
                    {item.collection === 'use-cases' ? 'Use Case' : item.collection.slice(0, -1).replace(/^\w/, c => c.toUpperCase())}
                  </span>
                  <div>
                    <div className="text-[13px] font-medium text-text-primary">{item.name}</div>
                    <div className="mt-0.5 text-[12px] text-text-secondary line-clamp-2">{item.description}</div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {activeTab === 'sources' && (
            <div id="sources" className="grid gap-0 sm:grid-cols-2">
              {sources.map((src, i) => (
                <div key={i} className="flex items-start gap-3 border-b border-border py-4 px-1">
                  <span className="mt-0.5 text-[14px]">
                    {src.type === 'arxiv' ? '📄' : src.type === 'doi' ? '🔬' : '🌐'}
                  </span>
                  <div>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] text-accent hover:underline"
                    >
                      {src.title || src.url}
                    </a>
                    <div className="mt-0.5 font-mono text-[12px] text-text-muted">
                      {src.type}{src.dateAccessed ? ` · accessed ${src.dateAccessed}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Build-validate**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/DetailTabs.tsx
git commit -m "feat: add DetailTabs component with rich subpage views"
```

---

## Task 8: Dashboard Grid + Customize Panel

**Files:**
- Create: `src/components/DashboardGrid.tsx`
- Create: `src/components/CustomizePanel.tsx`

- [ ] **Step 1: Install react-grid-layout**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
npm install react-grid-layout
npm install -D @types/react-grid-layout
```

- [ ] **Step 2: Create CustomizePanel.tsx**

**Note:** The card size selector (half/full width toggle) is deferred — the initial version only has on/off toggles and reset. The `onResize` prop is wired as a no-op. Card sizes use the defaults from `DetailPage.tsx`. This can be added later if users request it.

Create `src/components/CustomizePanel.tsx`:

```tsx
import { motion, AnimatePresence } from 'framer-motion';

export interface CardConfig {
  id: string;
  label: string;
  visible: boolean;
  fullWidth: boolean;
}

interface CustomizePanelProps {
  open: boolean;
  onClose: () => void;
  cards: CardConfig[];
  onToggle: (id: string) => void;
  onResize: (id: string, fullWidth: boolean) => void;
  onReset: () => void;
}

export default function CustomizePanel({ open, onClose, cards, onToggle, onResize, onReset }: CustomizePanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-void/60"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed right-0 top-0 z-50 h-full w-80 border-l border-border bg-surface p-6 overflow-y-auto"
          >
            <h3 className="font-heading text-[16px] font-semibold text-text-primary">Customize Layout</h3>
            <p className="mt-1 text-[13px] text-text-secondary">Toggle, resize, and drag cards. Saved automatically.</p>

            <div className="mt-6">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-3">
                Visible Cards
              </div>
              {cards.map(card => (
                <div key={card.id} className="flex items-center justify-between border-b border-border py-3">
                  <span className="text-[13px] text-text-primary">☰ {card.label}</span>
                  <button
                    onClick={() => onToggle(card.id)}
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium ${
                      card.visible
                        ? 'bg-accent/15 text-accent'
                        : 'bg-elevated text-text-muted'
                    }`}
                  >
                    {card.visible ? 'ON' : 'OFF'}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg bg-gradient-to-r from-accent to-cyan px-4 py-2.5 text-[13px] font-semibold text-void"
              >
                Done
              </button>
              <button
                onClick={onReset}
                className="rounded-lg border border-border px-4 py-2.5 text-[13px] text-text-muted hover:text-text-secondary"
              >
                Reset
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: Create DashboardGrid.tsx**

Create `src/components/DashboardGrid.tsx`:

```tsx
import { useState, useCallback, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface CardData {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface DashboardGridProps {
  collection: string;
  cards: CardData[];
  visibleCardIds: string[];
  fullWidthCardIds: string[];
}

export default function DashboardGrid({ collection, cards, visibleCardIds, fullWidthCardIds }: DashboardGridProps) {
  const layoutKey = `kvantiq-layout-${collection}-default`;

  const generateLayout = useCallback(() => {
    const visible = cards.filter(c => visibleCardIds.includes(c.id));
    let y = 0;
    let col = 0;
    return visible.map(card => {
      const isFull = fullWidthCardIds.includes(card.id);
      if (isFull) {
        if (col === 1) { y += 2; col = 0; } // flush pending half-width row
        const item = { i: card.id, x: 0, y, w: 2, h: 2, minH: 1 };
        y += 2;
        col = 0;
        return item;
      } else {
        const item = { i: card.id, x: col, y, w: 1, h: 2, minH: 1 };
        if (col === 1) { y += 2; col = 0; } else { col = 1; }
        return item;
      }
    });
  }, [cards, visibleCardIds, fullWidthCardIds]);

  const [layouts, setLayouts] = useState(() => {
    if (typeof window === 'undefined') return { lg: generateLayout() };
    const saved = localStorage.getItem(layoutKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch { /* fall through */ }
    }
    return { lg: generateLayout(), sm: generateLayout().map(l => ({ ...l, w: 1, x: 0 })) };
  });

  const onLayoutChange = useCallback((_: unknown, allLayouts: Record<string, unknown>) => {
    setLayouts(allLayouts);
    if (typeof window !== 'undefined') {
      localStorage.setItem(layoutKey, JSON.stringify(allLayouts));
    }
  }, [layoutKey]);

  const visibleCards = cards.filter(c => visibleCardIds.includes(c.id));

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      breakpoints={{ lg: 1100, md: 768, sm: 0 }}
      cols={{ lg: 2, md: 2, sm: 1 }}
      rowHeight={80}
      draggableHandle=".card-drag"
      onLayoutChange={onLayoutChange}
      isResizable={false}
    >
      {visibleCards.map(card => (
        <div key={card.id} className="rounded-xl border border-border bg-surface p-6 transition-colors hover:border-accent/10">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-text-primary">
              {card.label}
            </span>
            <span className="card-drag cursor-move text-[12px] tracking-[2px] text-border hover:text-text-muted">
              ⁞⁞
            </span>
          </div>
          {card.content}
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
```

- [ ] **Step 4: Build-validate**

Run: `npm run build`
Expected: Build succeeds. Both components compile.

- [ ] **Step 5: Commit**

```bash
git add src/components/DashboardGrid.tsx src/components/CustomizePanel.tsx package.json package-lock.json
git commit -m "feat: add customizable dashboard grid and customize panel"
```

---

## Task 9: Wire Detail Pages

**Files:**
- Create: `src/components/DetailPage.tsx`
- Modify: `src/pages/companies/[slug].astro`
- Modify: `src/pages/benchmarks/[slug].astro`
- Modify: `src/pages/use-cases/[slug].astro`
- Modify: `src/pages/challenges/[slug].astro`

- [ ] **Step 1: Create DetailPage.tsx orchestrator**

Create `src/components/DetailPage.tsx` — wires together Hero, Tabs, DashboardGrid, and CustomizePanel:

```tsx
import { useState } from 'react';
import DetailHero from './DetailHero';
import DetailTabs from './DetailTabs';
import DashboardGrid from './DashboardGrid';
import CustomizePanel, { type CardConfig } from './CustomizePanel';
import type { RelatedItem } from '../lib/related';

interface DetailPageProps {
  type: string;
  name: string;
  meta: string;
  description: string;
  tags: string[];
  stats: { value: string; label: string }[];
  websiteUrl?: string;
  websiteLabel?: string;
  collection: string;
  news: { title: string; excerpt?: string; url: string; source: string; date: string }[];
  related: RelatedItem[];
  sources: { type: string; url: string; title?: string; dateAccessed?: string }[];
  /** Extra content cards specific to this content type */
  extraCards?: { id: string; label: string; content: React.ReactNode }[];
}

const DEFAULT_CARDS = [
  { id: 'overview', label: 'Overview', visible: true, fullWidth: true },
  { id: 'news', label: 'Latest News', visible: true, fullWidth: false },
  { id: 'metrics', label: 'Key Metrics', visible: true, fullWidth: false },
  { id: 'related', label: 'Related', visible: true, fullWidth: false },
  { id: 'sources', label: 'Sources', visible: true, fullWidth: true },
];

export default function DetailPage(props: DetailPageProps) {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [cardConfigs, setCardConfigs] = useState<CardConfig[]>(() => {
    // Hide news card if no news, hide related if < 2
    return DEFAULT_CARDS.map(c => ({
      ...c,
      visible: c.id === 'news' ? props.news.length > 0 :
               c.id === 'related' ? props.related.length >= 2 :
               c.visible,
    }));
  });

  const toggleCard = (id: string) => {
    setCardConfigs(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const resetCards = () => {
    setCardConfigs(DEFAULT_CARDS.map(c => ({
      ...c,
      visible: c.id === 'news' ? props.news.length > 0 :
               c.id === 'related' ? props.related.length >= 2 :
               c.visible,
    })));
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`kvantiq-layout-${props.collection}-default`);
    }
  };

  // Build card content
  const dashboardCards = [
    {
      id: 'overview',
      label: 'Overview',
      content: <p className="text-[15px] text-text-secondary leading-[1.7]">{props.description}</p>,
    },
    {
      id: 'news',
      label: 'Latest News',
      content: (
        <div className="flex flex-col gap-4">
          {props.news.slice(0, 3).map((item, i) => (
            <div key={i} className="border-b border-border pb-4 last:border-0 last:pb-0">
              <div className="text-[14px] font-medium text-text-primary">{item.title}</div>
              <div className="mt-1 flex gap-2 font-mono text-[12px] text-text-muted">
                <span>{item.date}</span>
                <span className="text-accent">{item.source} ↗</span>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'metrics',
      label: 'Key Metrics',
      content: (
        <div className="grid grid-cols-2 gap-2.5">
          {props.stats.map(stat => (
            <div key={stat.label} className="rounded-lg bg-elevated p-3 text-center">
              <div className="font-heading text-lg font-bold text-text-primary">{stat.value}</div>
              <div className="mt-0.5 font-mono text-[10px] text-text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'related',
      label: 'Related',
      content: (
        <div className="flex flex-col gap-2">
          {props.related.slice(0, 3).map(item => (
            <a key={item.slug} href={item.href} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0 hover:text-accent transition-colors">
              <span className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                item.collection === 'benchmarks' ? 'bg-info/15 text-info' :
                item.collection === 'use-cases' ? 'bg-accent-glow text-accent' :
                item.collection === 'companies' ? 'bg-warn/15 text-warn' :
                'bg-elevated text-text-muted'
              }`}>
                {item.collection === 'use-cases' ? 'Use Case' : item.collection.slice(0, -1).replace(/^\w/, c => c.toUpperCase())}
              </span>
              <span className="text-[13px] text-text-primary">{item.name}</span>
            </a>
          ))}
        </div>
      ),
    },
    {
      id: 'sources',
      label: 'Sources',
      content: (
        <div className="grid sm:grid-cols-2 gap-x-6">
          {props.sources.map((src, i) => (
            <div key={i} className="flex items-start gap-2.5 border-b border-border py-3">
              <span className="mt-0.5">{src.type === 'arxiv' ? '📄' : src.type === 'doi' ? '🔬' : '🌐'}</span>
              <div>
                <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-accent hover:underline">
                  {src.title || src.url}
                </a>
                <div className="mt-0.5 font-mono text-[12px] text-text-muted">
                  {src.type}{src.dateAccessed ? ` · accessed ${src.dateAccessed}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    ...(props.extraCards || []),
  ];

  return (
    <>
      <DetailHero
        type={props.type}
        name={props.name}
        meta={props.meta}
        description={props.description}
        tags={props.tags}
        stats={props.stats}
        websiteUrl={props.websiteUrl}
        websiteLabel={props.websiteLabel}
        sourceCount={props.sources.length}
      />

      <DetailTabs
        news={props.news}
        related={props.related}
        sources={props.sources}
        onCustomize={() => setCustomizeOpen(true)}
      >
        <DashboardGrid
          collection={props.collection}
          cards={dashboardCards}
          visibleCardIds={cardConfigs.filter(c => c.visible).map(c => c.id)}
          fullWidthCardIds={cardConfigs.filter(c => c.fullWidth).map(c => c.id)}
        />
      </DetailTabs>

      <CustomizePanel
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        cards={cardConfigs}
        onToggle={toggleCard}
        onResize={() => {}}
        onReset={resetCards}
      />
    </>
  );
}
```

- [ ] **Step 2: Read all 4 detail page .astro files**

Read `src/pages/companies/[slug].astro`, `benchmarks/[slug].astro`, `use-cases/[slug].astro`, `challenges/[slug].astro` to understand current structure.

- [ ] **Step 3: Rewrite companies/[slug].astro**

Replace `src/pages/companies/[slug].astro` with the new layout. Keep the `getStaticPaths`, JSON-LD (Organization, but remove FAQPage), and add related items computation in frontmatter:

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import JsonLd from '../../components/JsonLd.astro';
import DetailPage from '../../components/DetailPage.tsx';
import { findRelated, type RelatedItem } from '../../lib/related';

export async function getStaticPaths() {
  const companies = await getCollection('companies');
  const benchmarks = await getCollection('benchmarks');
  const useCases = await getCollection('use-cases');
  const challenges = await getCollection('challenges');
  const resources = await getCollection('resources');

  // Build global items list for related matching
  const allItems: RelatedItem[] = [
    ...companies.map(c => ({ slug: c.data.slug, name: c.data.name, description: c.data.description, collection: 'companies', tags: c.data.tags, href: `/companies/${c.data.slug}/` })),
    ...benchmarks.map(b => ({ slug: b.data.slug, name: b.data.name, description: b.data.description, collection: 'benchmarks', tags: b.data.tags, href: `/benchmarks/${b.data.slug}/` })),
    ...useCases.map(u => ({ slug: u.data.slug, name: u.data.name, description: u.data.description, collection: 'use-cases', tags: u.data.tags, href: `/use-cases/${u.data.slug}/` })),
    ...challenges.map(ch => ({ slug: ch.data.slug, name: ch.data.name, description: ch.data.description, collection: 'challenges', tags: ch.data.tags, href: `/challenges/${ch.data.slug}/` })),
    ...resources.map(r => ({ slug: r.data.slug, name: r.data.name, description: r.data.description, collection: 'resources', tags: r.data.tags, href: `/resources/` })),
  ];

  return companies.map(c => ({
    params: { slug: c.data.slug },
    props: {
      company: c.data,
      related: findRelated(c.data.slug, c.data.tags, allItems),
    },
  }));
}

const { company, related } = Astro.props;

const orgLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": company.name,
  "url": company.website,
  "description": company.description,
  ...(company.founded && { "foundingDate": String(company.founded) }),
  ...(company.headquarters && {
    "address": { "@type": "PostalAddress", "addressLocality": company.headquarters }
  }),
};

const stats = [
  ...(company.employees ? [{ value: company.employees, label: 'Employees' }] : []),
  ...(company.funding ? [{ value: company.funding, label: 'Funding' }] : []),
  { value: company.region === 'nordics' ? 'Nordics' : company.region === 'dach' ? 'DACH' : company.region.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()), label: 'Region' },
];

const meta = [company.country, company.type.replace(/^\w/, c => c.toUpperCase()), company.founded ? `Founded ${company.founded}` : '', company.headquarters].filter(Boolean).join(' · ');
---
<BaseLayout title={company.name} description={company.description} jsonLd={orgLd}>
  <DetailPage
    client:load
    type="Company"
    name={company.name}
    meta={meta}
    description={company.description}
    tags={company.tags}
    stats={stats}
    websiteUrl={company.website}
    collection="companies"
    news={company.news || []}
    related={related}
    sources={company.sources}
  />
</BaseLayout>
```

- [ ] **Step 4: Rewrite benchmarks/[slug].astro**

Same pattern. Stats: algorithm, category, qubits, reproducible. Meta: algorithm + category + qubits.

- [ ] **Step 5: Rewrite use-cases/[slug].astro**

Same pattern. Stats: industry, category. Extra cards: "Problem" and "Approach" cards.

- [ ] **Step 6: Rewrite challenges/[slug].astro**

Same pattern. Stats: status, organizer, location. Meta: organizer + status + dates.

- [ ] **Step 7: Build-validate**

Run: `npm run build`
Expected: All 164 pages build successfully.

- [ ] **Step 8: Visual verification**

Take Playwright screenshots of:
- `/companies/parityqc/` (desktop + mobile)
- `/benchmarks/qaoa-maxcut/` (desktop + mobile)
- `/use-cases/drug-discovery-hybrid/` (desktop)
- `/challenges/qhack-2025/` (desktop)

All should show dark hero + tab bar + dashboard grid.

- [ ] **Step 9: Commit**

```bash
git add src/components/DetailPage.tsx src/pages/companies/[slug].astro src/pages/benchmarks/[slug].astro src/pages/use-cases/[slug].astro src/pages/challenges/[slug].astro
git commit -m "feat: wire detail pages with hero, tabs, and dashboard grid"
```

---

## Task 10: Listing Page View Toggle

**Files:**
- Create: `src/components/CardGrid.tsx`
- Create: `src/components/ViewToggle.tsx`
- Modify: `src/pages/companies/index.astro`
- Modify: `src/pages/benchmarks/index.astro`
- Modify: `src/pages/use-cases/index.astro`
- Modify: `src/pages/challenges/index.astro`
- Modify: `src/pages/resources/index.astro`

- [ ] **Step 1: Create ViewToggle.tsx**

Create `src/components/ViewToggle.tsx`:

```tsx
import { useState } from 'react';

interface ViewToggleProps {
  tableView: React.ReactNode;
  cardView: React.ReactNode;
}

export default function ViewToggle({ tableView, cardView }: ViewToggleProps) {
  const [view, setView] = useState<'table' | 'cards'>('table');

  return (
    <div>
      <div className="flex justify-end mb-4">
        <div className="flex rounded-lg border border-border bg-base p-0.5">
          <button
            onClick={() => setView('table')}
            className={`rounded-md px-3 py-1.5 font-mono text-[11px] transition-colors ${
              view === 'table' ? 'bg-surface text-accent' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            ☰ Table
          </button>
          <button
            onClick={() => setView('cards')}
            className={`rounded-md px-3 py-1.5 font-mono text-[11px] transition-colors ${
              view === 'cards' ? 'bg-surface text-accent' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            ☐ Cards
          </button>
        </div>
      </div>
      {view === 'table' ? tableView : cardView}
    </div>
  );
}
```

- [ ] **Step 2: Create CardGrid.tsx**

Create `src/components/CardGrid.tsx` — renders richer card grids for each collection type:

```tsx
import { motion } from 'framer-motion';

interface CardItem {
  href: string;
  name: string;
  description: string;
  tags: string[];
  meta: string;        // "Austria · Software" or "QAOA · Optimization"
  badge?: string;       // "Featured", "Open Source", "Active", etc.
  badgeColor?: string;  // Tailwind color class: "text-accent", "text-warn", etc.
  stats?: { label: string; value: string }[];
}

interface CardGridProps {
  items: CardItem[];
}

export default function CardGrid({ items }: CardGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => (
        <motion.a
          key={item.href}
          href={item.href}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
          className="block rounded-xl border border-border bg-surface p-6 transition-all duration-200 hover:border-accent/20 hover:shadow-glow"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-heading text-[15px] font-semibold text-text-primary">{item.name}</h3>
            {item.badge && (
              <span className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-[10px] font-medium ${item.badgeColor || 'text-accent'} bg-accent-glow`}>
                {item.badge}
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-[11px] text-text-muted">{item.meta}</p>
          <p className="mt-2 text-[13px] text-text-secondary leading-relaxed line-clamp-2">{item.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.tags.slice(0, 3).map(tag => (
              <span key={tag} className="rounded-md border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                {tag}
              </span>
            ))}
          </div>
        </motion.a>
      ))}
    </div>
  );
}
```

Each listing page maps its collection data to `CardItem[]`. For example, companies pass `meta: \`${c.country} · ${c.type}\``, `badge: c.featured ? 'Featured' : undefined`.

- [ ] **Step 3: Update listing pages**

Read each index page, then wrap the existing `<DataTable>` and card section inside a `<ViewToggle>` component with `client:load`. Update page headers and surrounding markup to use dark theme tokens.

- [ ] **Step 4: Build-validate**

Run: `npm run build`
Expected: All listing pages build and render.

- [ ] **Step 5: Visual verification**

Take screenshots of `/companies/` in both table and card views.

- [ ] **Step 6: Commit**

```bash
git add src/components/CardGrid.tsx src/components/ViewToggle.tsx src/pages/
git commit -m "feat: add table/card view toggle to listing pages"
```

---

## Task 11: AI Sweep GitHub Action

**Files:**
- Create: `scripts/ai-sweep.mjs`
- Create: `.github/workflows/ai-sweep.yml`

- [ ] **Step 1: Install Anthropic SDK**

```bash
npm install -D @anthropic-ai/sdk
```

- [ ] **Step 2: Create the sweep script**

Create `scripts/ai-sweep.mjs`. The script:
1. Reads all JSON entries across all collections
2. For each entry, fetches content from source URLs (HTTP GET, strip HTML)
3. If ALL fetches fail, skips the entry
4. Sends fetched content + current JSON to Claude API with strict extraction-only instructions
5. Validates returned news items: discard any with URLs not matching fetched source domains
6. Prunes news items older than 6 months
7. Caps at 5 news items per entry
8. Writes updated JSON only if changes exist
9. Prints a summary table to stdout

Key constraints in the Claude prompt:
- "Extract ONLY news items explicitly stated in the provided content"
- "Do NOT invent, infer, or recall from training data"
- "Date format: YYYY-MM-DD"
- "Each news item MUST include a URL matching one of the provided sources"

- [ ] **Step 3: Create the GitHub Action workflow**

Create `.github/workflows/ai-sweep.yml`:

```yaml
name: Weekly AI Content Sweep

on:
  schedule:
    - cron: '0 0 * * 0'  # Sunday midnight UTC
  workflow_dispatch:

jobs:
  sweep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Run AI sweep
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: node scripts/ai-sweep.mjs

      - name: Validate build
        run: npm run build

      - name: Create PR if changes exist
        uses: peter-evans/create-pull-request@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: 'content: weekly AI content sweep'
          title: 'content: weekly AI content sweep'
          body: |
            ## Weekly AI Content Sweep

            Automated content freshness check. News items extracted from source URLs.

            **Review checklist:**
            - [ ] News items are factual (spot-check 3-5 entries)
            - [ ] No fabricated funding rounds or partnerships
            - [ ] All news URLs resolve to real pages
            - [ ] Build passes (CI will verify)
          branch: ai-sweep/weekly
          labels: ai-sweep
          delete-branch: true
```

- [ ] **Step 4: Build-validate**

Run: `npm run build`
Expected: Build succeeds. Script file exists but doesn't run during build.

- [ ] **Step 5: Commit**

```bash
git add scripts/ai-sweep.mjs .github/workflows/ai-sweep.yml package.json package-lock.json
git commit -m "feat: add weekly AI content sweep script and GitHub Action"
```

---

## Task 12: Final Validation

- [ ] **Step 1: Full clean build**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
rm -rf dist .astro
npm run build
```

Expected: Clean build, all pages generated, Pagefind indexes all content.

- [ ] **Step 2: Visual verification — all page types**

Take Playwright screenshots at desktop (1280x800) and mobile (375x812):
- Homepage
- `/companies/` (table view)
- `/companies/parityqc/` (detail page)
- `/benchmarks/` (table view)
- `/benchmarks/qaoa-maxcut/` (detail page)
- `/use-cases/drug-discovery-hybrid/` (detail page)
- `/challenges/qhack-2025/` (detail page)
- `/resources/` (index only)
- `/about/`

All pages should render in Quantum Phosphor dark theme with correct typography, spacing, and hover effects.

- [ ] **Step 3: Test customization**

Manually test in browser:
- Click ⚙ Customize on a detail page
- Toggle a card off → it disappears
- Toggle it back on → it reappears
- Click Reset → layout restores to default
- Refresh page → layout persists from localStorage

- [ ] **Step 4: Test tab navigation**

On a detail page:
- Click each tab (Overview, Latest News if available, Related if available, Sources)
- Content area changes without page reload
- Animation transitions smoothly

- [ ] **Step 5: Deploy and verify live**

```bash
git push origin feature/directory-site
```

Create PR, merge to main, verify Vercel deployment at `https://directory.kvantiq.studio`.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: final validation — UI redesign complete"
```
