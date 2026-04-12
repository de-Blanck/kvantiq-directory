# Content Enrichment & Editorial Theme Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich all 183 directory entries to meet minimum content thresholds, fix editorial light theme gaps, and add cross-collection linking — so that both a CTO evaluating partners and a PhD student finding benchmarks get real value from every page.

**Architecture:** Three workstreams run sequentially: (1) UI fixes for the editorial light theme, (2) schema enrichment with quality gates, (3) content enrichment and cross-linking. All content changes are JSON edits validated by Zod at build time. No new pages — we extend existing components and pass new data via the `extraCards` prop pattern.

**Tech Stack:** Astro 6, Zod schemas, Tailwind CSS 4, React (DetailPage/DetailTabs), Playwright (visual verification)

**Inventory:** 74 companies, 32 benchmarks, 23 use cases, 12 challenges, 42 resources = 183 entries total

**Important:** Resources have NO detail pages (`[slug].astro`). They only have an index page that links to external sites. Resource enrichment data surfaces on the index page only.

**Port note:** Dev server runs on Astro default port 4321. If port is occupied (another Astro instance), Astro auto-increments. Check terminal output for actual port before running Playwright.

---

## Workstream A: Editorial Light Theme Polish

### Task A1: Fix remaining Quantum Phosphor color references in components

**Files:**
- Modify: `src/components/DetailHero.tsx` (stat boxes, type badge)
- Modify: `src/components/DetailPage.tsx` (badge colors)
- Modify: `src/components/CustomizePanel.tsx` (gradient button + text-void)
- Modify: `src/components/CardGrid.tsx` (hover:shadow-glow is broken — resolves to `none`)
- Modify: `src/components/DashboardGrid.tsx` (card header labels)
- Modify: `src/components/ListingView.tsx`
- Modify: `src/components/Footer.astro`
- Modify: `src/pages/companies/index.astro:37` (Featured badge color)

- [ ] **Step 1: Grep for all Quantum Phosphor-era color patterns**

```bash
cd /e/kvantiq-directory/.worktrees/feature-directory-site
grep -rn "from-accent\|to-cyan\|shadow-glow\|text-void" src/components/ src/pages/ --include="*.tsx" --include="*.astro"
```

Every match must be fixed. Note: `bg-accent-glow` is intentionally kept — it maps to `rgba(180, 83, 9, 0.08)` (subtle amber tint), which works on the editorial theme. Do NOT change `bg-accent-glow` or `text-accent` on badges — those are correct.

- [ ] **Step 2: Replace each instance with editorial-appropriate equivalents**

| Old Pattern | New Pattern | Reason |
|-------------|-------------|--------|
| `bg-gradient-to-r from-accent to-cyan` | `bg-info text-white` | Solid blue CTA, editorial style |
| `text-void` (on buttons/badges) | `text-white` | `void` is now light parchment, not dark |
| `shadow-glow` | `shadow-subtle` | `shadow-glow` is `none` in editorial theme |
| `hover:shadow-glow` | `hover:shadow-elevated` | Restore visible hover effect |
| `text-accent` (for active/selected UI states) | `text-info` | Blue for interactive states |

Key files with the worst issues:
- `CustomizePanel.tsx:64` — `from-accent to-cyan` + `text-void` (Done button is invisible)
- `CardGrid.tsx` — `hover:shadow-glow` (hover effect silently broken)

- [ ] **Step 3: Update the stat boxes in DetailHero**

The stat boxes (`100+`, `CHF 50M+`, `DACH`) use `bg-surface` which blends with the card bg on light theme. Change to:

```tsx
// In DetailHero.tsx, stat boxes:
className="rounded-xl border border-border bg-base p-4 text-center"
// Value text:
className="text-lg font-bold text-text-primary"
// Label text:
className="mt-0.5 font-mono text-[11px] text-text-muted"
```

- [ ] **Step 4: Verify with Playwright at 1440x900**

```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4321/companies/kvantify/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'verify-a1-detail.png' });
  await page.goto('http://localhost:4321/companies/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'verify-a1-listing.png' });
  await browser.close();
})();
"
```

Expected: No green/cyan gradients, no invisible text, all badges readable, hover effects visible.

- [ ] **Step 5: Commit**

```bash
git add src/components/ src/pages/
git commit -m "fix: replace Quantum Phosphor color references with editorial light palette"
```

---

### Task A2: Fix tab transition viewport artifact

**Files:**
- Modify: `src/components/DetailTabs.tsx`

**Current state:** `AnimatePresence mode="popLayout"` is already in place (previously fixed). The remaining issue is the `overflow-x-hidden` wrapper on line 55 which clips content during tab switch, and missing layout stability causing content height to collapse during the crossfade.

- [ ] **Step 1: Remove overflow-x-hidden and add min-height stabilizer**

```tsx
// Line 55: Change from:
<div className="overflow-x-hidden">
// To:
<div>
```

```tsx
// Wrap the AnimatePresence in a min-height container:
<div className="relative min-h-[200px]">
  <AnimatePresence mode="popLayout">
    <motion.div
      key={activeTab}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className="w-full"
    >
```

- [ ] **Step 2: Verify tab switching is smooth**

```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4321/companies/kvantify/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'verify-a2-overview.png' });
  await page.click('button:has-text(\"Related\")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'verify-a2-related.png' });
  await page.click('button:has-text(\"Overview\")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'verify-a2-back.png' });
  await browser.close();
})();
"
```

Expected: No layout jump, no content flash, smooth opacity crossfade.

- [ ] **Step 3: Commit**

```bash
git add src/components/DetailTabs.tsx
git commit -m "fix: remove overflow-x-hidden and add min-height to prevent tab switch artifact"
```

---

## Workstream B: Schema Enrichment & Content Quality Gates

### Task B1: Add new optional schema fields for content depth

**Files:**
- Modify: `src/content.config.ts`

These new fields address the persona gaps identified in the audit.

- [ ] **Step 1: Add fields to companies schema**

```typescript
// After 'funding' in companies schema:
accessModel: nonEmpty.optional(), // Free-text: "Cloud API", "On-premise + consulting", etc.
products: z.array(z.object({
  name: nonEmpty,
  description: z.string().min(10),
  url: z.string().url().optional(),
})).optional(),
highlights: z.array(nonEmpty).optional(), // Key differentiators, max 5
```

Note: `accessModel` is `nonEmpty` (free text), NOT an enum. An enum is too restrictive for 74 companies with varied business models (e.g. "hardware sales", "cloud + license", "research partnership").

- [ ] **Step 2: Add fields to challenges schema**

```typescript
// After 'location' in challenges schema:
eligibility: nonEmpty.optional(),       // "Open to EU students"
teamSize: nonEmpty.optional(),          // "2-5 members"
registrationDeadline: nonEmpty.optional(),
problemDomains: z.array(nonEmpty).optional(), // ["optimization", "drug-discovery"]
```

- [ ] **Step 3: Add fields to resources schema**

```typescript
// After 'provider' in resources schema:
lastUpdated: nonEmpty.optional(),       // "2026-01" or "Active"
maturity: z.enum(['experimental', 'stable', 'mature', 'archived']).optional(),
communitySize: nonEmpty.optional(),     // "10K+ GitHub stars"
```

Note: No `prerequisites` field — resources have no detail page to display it. The `lastUpdated`, `maturity`, and `communitySize` fields will surface on the resources index page as metadata pills next to each entry.

- [ ] **Step 4: Run build to confirm schema is backward-compatible**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds — all new fields are optional, existing JSON unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/content.config.ts
git commit -m "feat: add optional schema fields for content depth (products, access model, maturity, eligibility)"
```

---

### Task B2: Display new fields on detail pages and index pages

**Files:**
- Modify: `src/pages/companies/[slug].astro` (pass products + highlights as extraCards)
- Modify: `src/pages/challenges/[slug].astro` (pass logistics as extraCards)
- Modify: `src/pages/resources/index.astro` (show maturity/freshness pills on list items)
- Do NOT modify `src/components/DetailPage.tsx` DEFAULT_CARDS — follow the existing `extraCards` pattern

**Important:** `products`, `highlights`, and challenge logistics are passed as `extraCards` from the page `.astro` file — the same pattern used by `use-cases/[slug].astro` for `problem` and `approach`. Do NOT add them to `DEFAULT_CARDS`, which is for universal cards only.

- [ ] **Step 1: Add products card to company detail page**

In `src/pages/companies/[slug].astro`, pass new `extraCards`:

```astro
extraCards={[
  ...(company.products?.length ? [{
    id: 'products',
    label: 'Products',
    content: React.createElement('div', { className: 'flex flex-col gap-3' },
      company.products.map((p, i) =>
        React.createElement('div', { key: i },
          React.createElement('span', { className: 'font-semibold text-text-primary' }, p.name),
          React.createElement('p', { className: 'text-sm text-text-secondary mt-0.5' }, p.description)
        )
      )
    )
  }] : []),
  ...(company.highlights?.length ? [{
    id: 'highlights',
    label: 'Key Highlights',
    content: company.highlights.map(h => `• ${h}`).join('\n')
  }] : []),
]}
```

Alternative: since `.astro` files cannot pass JSX to React components, create a simple `ProductsCard.tsx` React component and import it. This is cleaner.

- [ ] **Step 2: Add logistics card to challenge detail page**

In `src/pages/challenges/[slug].astro`, add extraCards for eligibility, team size, registration deadline, problem domains — if any fields are present.

- [ ] **Step 3: Surface freshness signals on resources index page**

In `src/pages/resources/index.astro`, add maturity/lastUpdated/communitySize as metadata pills next to each resource entry in the card items. No detail page exists — this is the only place to show this data.

```astro
// In cardItems mapping, add to meta string:
meta: [r.data.type, r.data.maturity, r.data.lastUpdated ? `Updated ${r.data.lastUpdated}` : ''].filter(Boolean).join(' · ')
```

- [ ] **Step 4: Build and verify**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/ src/components/
git commit -m "feat: display products, highlights, logistics on detail pages; freshness signals on resources index"
```

---

### Task B3: Define minimum content thresholds

**Files:**
- Create: `scripts/content-audit.ts`

This script runs at CI time and flags entries below quality thresholds. Can run immediately after B1 (does not depend on B2).

- [ ] **Step 1: Write the audit script**

```typescript
// scripts/content-audit.ts
// Reads all JSON entries from src/content/, checks:
// - description length >= 80 chars (2+ sentences)
// - companies: employees OR funding present
// - challenges: dateStart AND prizes present
// - use-cases: results field present
// - resources: lastUpdated OR maturity present (once enriched)
// Output: table of entries with rating (RICH/ADEQUATE/SPARSE) + counts
// Exit 0 always (warning report, does not block build)
```

Thresholds (WARNING level — does not block build, just reports):

| Collection | Minimum for ADEQUATE | Minimum for RICH |
|------------|---------------------|-----------------|
| Companies | description ≥80 chars, ≥1 of (employees, funding) | + products array, + highlights |
| Benchmarks | description ≥80 chars, hardware present | + specific numeric results in description |
| Use Cases | description ≥80 chars, results present | + companies array |
| Challenges | description ≥80 chars, prizes present, dateStart present | + eligibility, + problemDomains |
| Resources | description ≥80 chars | + lastUpdated, + maturity |

- [ ] **Step 2: Add npm script**

In `package.json`, add to scripts:

```json
"audit:content": "npx tsx scripts/content-audit.ts"
```

- [ ] **Step 3: Run audit against current content**

```bash
npm run audit:content
```

Expected: Generates a report showing which entries are below ADEQUATE threshold. This becomes the enrichment hit list for Workstream C.

- [ ] **Step 4: Commit**

```bash
git add scripts/content-audit.ts package.json
git commit -m "feat: add content quality audit script with minimum thresholds"
```

---

## Workstream C: Content Enrichment (Data Work)

### Task C1: Enrich companies with products, access model, highlights

**Files:**
- Modify: `src/content/companies/*.json` (all 74 files)

This is the highest-impact enrichment. Every company page should answer: "What do they sell? How do I access it? Why should I care?"

- [ ] **Step 1: Prioritize by Featured first, then alphabetical**

Start with the 6 featured companies (AQT, Bluefors, ID Quantique, IQM, Pasqal, Quandela), then remaining 68.

- [ ] **Step 2: For each company, add at minimum:**

```json
{
  "accessModel": "Cloud API + consulting",
  "products": [
    { "name": "Product Name", "description": "One-sentence what it does" }
  ],
  "highlights": [
    "First commercial QKD system in Europe",
    "Partnership with Swiss national quantum initiative"
  ]
}
```

Source requirement: Each new fact must be verifiable from the existing `sources` array or a new source must be added.

- [ ] **Step 3: Extend descriptions that are below 80 chars**

Any description under 80 characters gets extended to 2-3 sentences with specific details (products, customers, tech differentiator).

- [ ] **Step 4: Build to validate all 74 entries**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 5: Run content audit**

```bash
npm run audit:content
```

Expected: 0 companies below ADEQUATE threshold.

- [ ] **Step 6: Commit**

```bash
git add src/content/companies/
git commit -m "content: enrich all 74 companies with products, access model, highlights"
```

---

### Task C2: Enrich challenges with logistics

**Files:**
- Modify: `src/content/challenges/*.json` (all 12 files)

- [ ] **Step 1: For each challenge, add:**

```json
{
  "eligibility": "Open to EU-based students and researchers",
  "teamSize": "2-5 members",
  "registrationDeadline": "2026-01-15",
  "problemDomains": ["optimization", "quantum-chemistry"]
}
```

Where `prizes` is missing, research and add it. Where data is genuinely not available, use `"prizes": "Not publicly disclosed"`.

- [ ] **Step 2: Build and audit**

```bash
npm run build && npm run audit:content
```

- [ ] **Step 3: Commit**

```bash
git add src/content/challenges/
git commit -m "content: enrich all 12 challenges with logistics (eligibility, team size, prizes, domains)"
```

---

### Task C3: Enrich resources with freshness signals

**Files:**
- Modify: `src/content/resources/*.json` (all 42 files)

This data surfaces on the resources index page (not a detail page — resources have no `[slug].astro`).

- [ ] **Step 1: For each resource, add:**

```json
{
  "lastUpdated": "2026-01",
  "maturity": "stable",
  "communitySize": "5K+ GitHub stars"
}
```

For courses: `lastUpdated` = last course run date. For tools: check GitHub for last commit and stars. For communities: member count.

- [ ] **Step 2: Build and audit**

```bash
npm run build && npm run audit:content
```

- [ ] **Step 3: Commit**

```bash
git add src/content/resources/
git commit -m "content: enrich all 42 resources with freshness signals (maturity, lastUpdated, communitySize)"
```

---

### Task C4: Add cross-collection links to use cases

**Files:**
- Modify: `src/content/use-cases/*.json` (all 23 files)
- Modify: `src/pages/use-cases/[slug].astro` (render companies as linked extraCard)

- [ ] **Step 1: For each use case, populate the `companies` array**

Map each use case to companies in the directory that are working in that space. Use the `tags` overlap to identify candidates, then verify.

```json
{
  "companies": ["pasqal", "kvantify", "aqora"]
}
```

These slugs must match actual `src/content/companies/*.json` filenames (without `.json`).

- [ ] **Step 2: Update `[slug].astro` to render companies as links**

In `src/pages/use-cases/[slug].astro`, add an extraCard that renders the `companies` array as clickable links to `/companies/{slug}/`. Resolve the slug to the company name by looking up from the companies collection.

- [ ] **Step 3: Build and verify cross-links render**

```bash
npm run build
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4321/use-cases/supply-chain-optimization/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'verify-c4-crosslinks.png' });
  await browser.close();
})();
"
```

- [ ] **Step 4: Commit**

```bash
git add src/content/use-cases/ src/pages/use-cases/[slug].astro
git commit -m "content: add cross-collection company links to all 23 use cases"
```

---

## Workstream D: CLAUDE.md Init for Worktree

### Task D1: Create CLAUDE.md in worktree with editorial theme + content rules

**Files:**
- Create: `/e/kvantiq-directory/.worktrees/feature-directory-site/CLAUDE.md`

- [ ] **Step 1: Write CLAUDE.md with updated design system reference**

The worktree CLAUDE.md should:
- Reference the Editorial Light theme (NOT Quantum Phosphor) with the new color tokens
- Document that `shadow-glow` is `none` — use `shadow-subtle`/`shadow-elevated` instead
- Document that `text-void` is now parchment — use `text-white` for light-on-dark text
- Include content quality thresholds from Task B3
- Reference the `npm run audit:content` script
- Keep the non-negotiable maintenance workflow from root CLAUDE.md
- Note that resources have NO detail pages

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: init CLAUDE.md for worktree with editorial theme and content quality rules"
```

---

## Execution Order

```
A1 (color fixes) → A2 (tab fix) → B1 (schema) → B3 (audit script) → C1 (companies) → C2 (challenges) → C3 (resources) → C4 (use-case cross-links)
                                        ↓                                                                                          ↓
                                   B2 (display fields) ──────────────────────────────────────────────────────────────────────→ D1 (CLAUDE.md)
```

B3 runs right after B1 (no dependency on B2) to produce the enrichment hit list early. B2 can run in parallel with B3.

**Estimated scope:**
- Workstream A: 2 tasks, code-only
- Workstream B: 3 tasks, schema + code + script
- Workstream C: 4 tasks, ~183 JSON file edits (bulk content work — largest workstream)
- Workstream D: 1 task, documentation

**Critical path:** A → B1 → B3 → C (content work depends on schema + audit script)

---

## Verification Checklist (run after all tasks complete)

```bash
# Full build
npm run build

# Content audit — 0 entries below ADEQUATE
npm run audit:content

# Visual verification — 3 viewports
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  for (const [w, h, name] of [[1440, 900, 'desktop'], [768, 1024, 'tablet'], [375, 812, 'mobile']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'final-home-' + name + '.png', fullPage: true });
    await page.goto('http://localhost:4321/companies/kvantify/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'final-detail-' + name + '.png', fullPage: true });
    await page.close();
  }
  await browser.close();
})();
"
```

Expected: All pages render correctly in editorial light theme, no broken colors, all new fields display when present, no Quantum Phosphor artifacts remaining.
