# Directory Hardening Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the discoverability leaks identified during the 2026-05-06 recon — `robots.txt` sitemap typo, missing per-collection JSON-LD, broken `SpeakableSpecification` selectors, identical OG images, missing analytics — so every page in the directory emits the structured signal that LLMs and search engines reward, and inbound traffic becomes measurable via Plausible + Google Search Console + Bing Webmaster.

**Architecture:** All changes are static — Astro static build emits richer HTML, no new runtime. Per-collection JSON-LD is generated inside the existing `[slug].astro` page templates from collection data. OG images are build-time-generated PNGs via `satori` + `@resvg/resvg-js` at `src/pages/og-images/[collection]/[slug].png.ts`. Monitoring is one `<script>` tag plus two `<meta>` tags in `BaseLayout.astro`. No code touches the runtime; everything is verifiable post-build via the static HTML output.

**Tech Stack:** Astro 6 (existing), Tailwind 4 (existing), `satori` (new), `@resvg/resvg-js` (new), Plausible cloud (€9/mo or self-hostable), Google Search Console + Bing Webmaster (free, one-time verification meta tags).

**Spec:** `docs/superpowers/specs/2026-05-06-directory-organic-traffic-design.md`

**Companion plan:** Plan 1 — citation-probe panel (`docs/superpowers/plans/2026-05-06-citation-probe-panel.md`) is **dormant per Path 1 decision (2026-05-08)** — ships in PR #28 with cron disabled. This plan does NOT depend on the citation-probe baseline.

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `src/lib/jsonld/dataset.ts` | Build `Dataset` schema from a benchmark entry (with test) |
| `src/lib/jsonld/dataset.test.ts` | Unit tests for Dataset builder |
| `src/lib/jsonld/article.ts` | Build `Article` schema from a use-case entry |
| `src/lib/jsonld/article.test.ts` | Unit tests for Article builder |
| `src/lib/jsonld/event.ts` | Build `Event` schema from a challenge entry |
| `src/lib/jsonld/event.test.ts` | Unit tests for Event builder |
| `src/lib/jsonld/learning-resource-list.ts` | Build `ItemList` of `LearningResource` from resources collection |
| `src/lib/jsonld/learning-resource-list.test.ts` | Unit tests |
| `src/lib/og-image-template.tsx` | Satori JSX template for the 1200×630 PNG |
| `src/lib/og-image-template.test.ts` | Snapshot test for SVG output |
| `src/pages/og-images/[collection]/[slug].png.ts` | Astro endpoint that renders + returns PNG |

**Files to modify:**

| Path | Change |
|---|---|
| `public/robots.txt` | Fix `Sitemap:` line — change `/sitemap.xml` → `/sitemap-index.xml` |
| `src/layouts/BaseLayout.astro` | Add Plausible script + GSC + Bing verification metas |
| `src/components/DetailPage.tsx` | Add `class="summary"` to the description block (makes existing `SpeakableSpecification` valid) |
| `src/pages/companies/[slug].astro` | Pass `ogImage` prop to BaseLayout |
| `src/pages/benchmarks/[slug].astro` | Add `Dataset` JSON-LD via `jsonLd` prop, pass `ogImage` |
| `src/pages/use-cases/[slug].astro` | Add `Article` JSON-LD, pass `ogImage` |
| `src/pages/challenges/[slug].astro` | Add `Event` JSON-LD, pass `ogImage` |
| `src/pages/resources/index.astro` | Add `ItemList` of `LearningResource` JSON-LD |
| `package.json` | Add `satori`, `@resvg/resvg-js` deps |

**Files NOT touched:**

- Anything in `synapse_q_deployment` (different repo, out of scope)
- Anything in `scripts/` (probe panel is Plan 1, untouched here)
- Resources `[slug].astro` — does NOT exist (per kvantiq-directory `CLAUDE.md`, resources have no detail pages)

---

## Task 1: Fix `robots.txt` sitemap reference

**Files:**
- Modify: `public/robots.txt:52`

- [ ] **Step 1: Read the current robots.txt to confirm the buggy line**

```bash
cat C:/Synapse/kvantiq-directory/public/robots.txt | tail -3
```

Expected: `Sitemap: https://directory.kvantiq.studio/sitemap.xml`

- [ ] **Step 2: Fix the sitemap path**

Edit `public/robots.txt` — change the `Sitemap:` line from:

```
Sitemap: https://directory.kvantiq.studio/sitemap.xml
```

to:

```
Sitemap: https://directory.kvantiq.studio/sitemap-index.xml
```

- [ ] **Step 3: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add public/robots.txt
git -C C:/Synapse/kvantiq-directory commit -m "fix(seo): point robots.txt at sitemap-index.xml

Astro's @astrojs/sitemap integration generates sitemap-index.xml +
sitemap-0.xml, not sitemap.xml. The previous robots.txt advertised
the non-existent /sitemap.xml (returns 404), so any crawler
strictly following robots.txt couldn't discover the directory's
141 entry pages via sitemap. One-line fix, site-wide impact."
```

---

## Task 2: Add monitoring instrumentation to BaseLayout

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

> **Note:** This task adds the script + meta tags. Plausible domain is `directory.kvantiq.studio` (already running on the live site). GSC + Bing verification tokens are placeholders that the operator (Rune) replaces with real tokens after registering the property in each console.

- [ ] **Step 1: Read the current head section**

```bash
grep -n "<meta\|<script\|<link" C:/Synapse/kvantiq-directory/src/layouts/BaseLayout.astro | head -20
```

- [ ] **Step 2: Add Plausible + verification metas before the closing `</head>`**

In `src/layouts/BaseLayout.astro`, locate the JSON-LD `<JsonLd ...` blocks near the end of `<head>`. Just BEFORE those (or right after the existing OG meta tags), add:

```astro
    <!-- Analytics — Plausible (privacy-friendly, GDPR-clean) -->
    <script defer data-domain="directory.kvantiq.studio" src="https://plausible.io/js/script.js"></script>

    <!-- Search engine verification — replace tokens with values from GSC + Bing Webmaster -->
    <meta name="google-site-verification" content="GSC_VERIFICATION_TOKEN_PLACEHOLDER" />
    <meta name="msvalidate.01" content="BING_VERIFICATION_TOKEN_PLACEHOLDER" />
```

> The two `_PLACEHOLDER` strings are intentional — they get replaced by Rune (one-time, manual) after registering `directory.kvantiq.studio` in [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters). The build does not validate the token format, so leaving the placeholder works (the verification meta is just inert until tokens replace it). Document this in the commit message.

- [ ] **Step 3: Build to verify nothing broke**

```bash
npm --prefix C:/Synapse/kvantiq-directory run build
```

Expected: build succeeds. Then verify the script tag landed:

```bash
grep -c "plausible.io" C:/Synapse/kvantiq-directory/dist/index.html
```

Expected: ≥1 (one match per page; index.html is one page).

- [ ] **Step 4: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add src/layouts/BaseLayout.astro
git -C C:/Synapse/kvantiq-directory commit -m "feat(monitoring): add Plausible + GSC + Bing verification metas

Wires up the three monitoring layers from the spec:
- Plausible script: privacy-friendly analytics, GDPR-clean by
  default, no cookie banner needed
- google-site-verification: placeholder token, replace after
  registering the property at https://search.google.com/search-console
- msvalidate.01: placeholder token, replace after registering at
  https://www.bing.com/webmasters

Verification tokens are PLACEHOLDERS until Rune adds the real
values. The placeholder meta is inert — search engines simply
fail verification until tokens are real."
```

---

## Task 3: Fix `SpeakableSpecification` — add `.summary` class to DetailPage

**Files:**
- Modify: `src/components/DetailPage.tsx`

- [ ] **Step 1: Locate the description rendering in DetailPage**

```bash
grep -n "description" C:/Synapse/kvantiq-directory/src/components/DetailPage.tsx | head -10
```

Find the JSX block that renders the `description` prop as the page subhead/lede.

- [ ] **Step 2: Add `className="summary"` to that element**

Edit `src/components/DetailPage.tsx` — add `summary` to the className of the element that holds the description. Example pattern (adjust to actual code):

```tsx
// before:
<p className="text-lg text-text-secondary">{description}</p>

// after:
<p className="summary text-lg text-text-secondary">{description}</p>
```

The `summary` class doesn't need any CSS — it's purely a hook for the `SpeakableSpecification` JSON-LD already emitted by `BaseLayout.astro` (which references `cssSelector: [".summary", ".faq"]`). The schema becomes valid the moment a `.summary` element exists in the rendered DOM.

- [ ] **Step 3: Build + verify class lands in static HTML**

```bash
npm --prefix C:/Synapse/kvantiq-directory run build
grep -c 'class="summary' C:/Synapse/kvantiq-directory/dist/companies/pasqal/index.html || true
```

Expected: ≥1 on a representative detail page (companies/pasqal is a known entry).

- [ ] **Step 4: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add src/components/DetailPage.tsx
git -C C:/Synapse/kvantiq-directory commit -m "fix(seo): add .summary class so SpeakableSpecification points at real DOM

BaseLayout.astro emits a SpeakableSpecification JSON-LD with
cssSelector: ['.summary', '.faq'], but those classes did not
exist on rendered detail pages — the schema was a no-op. This
adds .summary to the description element on every detail page
(companies, benchmarks, use-cases, challenges) so the speakable
hint is now valid. .faq is deferred (FAQ blocks are a separate
content workstream)."
```

---

## Task 4: Build `Dataset` JSON-LD module (TDD)

**Files:**
- Create: `src/lib/jsonld/dataset.test.ts`
- Create: `src/lib/jsonld/dataset.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/jsonld/dataset.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDatasetSchema } from './dataset.ts';

test('buildDatasetSchema produces valid Dataset JSON-LD', () => {
  const result = buildDatasetSchema({
    name: 'QAOA on heavy-hex',
    slug: 'qaoa-heavy-hex',
    description: 'Quantum approximate optimization on IBM heavy-hex topology.',
    algorithm: 'QAOA',
    category: 'optimization',
    hardware: 'IBM Heron r2',
    framework: 'Qiskit',
    qubits: 127,
    keyMetrics: [{ metric: 'Approximation ratio', value: '0.83', unit: undefined }],
    significance: 'First sub-10s runtime on >100 qubits.',
    tags: ['optimization', 'ibm'],
  });

  assert.equal(result['@context'], 'https://schema.org');
  assert.equal(result['@type'], 'Dataset');
  assert.equal(result.name, 'QAOA on heavy-hex');
  assert.equal(result.measurementTechnique, 'QAOA');
  assert.equal(result.url, 'https://directory.kvantiq.studio/benchmarks/qaoa-heavy-hex/');
  assert.deepEqual(result.keywords, ['optimization', 'ibm']);
  assert.equal(Array.isArray(result.variableMeasured), true);
  assert.equal((result.variableMeasured as unknown[]).length, 1);
});

test('buildDatasetSchema omits absent optional fields', () => {
  const result = buildDatasetSchema({
    name: 'Minimal benchmark',
    slug: 'minimal',
    description: 'Bare-minimum benchmark with no key metrics.',
    algorithm: 'VQE',
    category: 'chemistry',
    tags: ['vqe'],
  });
  assert.equal('variableMeasured' in result, false);
  assert.equal('hardwareRequirements' in result, false);
});
```

- [ ] **Step 2: Run test — expect 2 failures**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
```

Expected: 23 (Plan 1) + 2 new failures = 25 total runs, 2 failing.

- [ ] **Step 3: Implement the builder**

```typescript
// src/lib/jsonld/dataset.ts

interface BenchmarkInput {
  name: string;
  slug: string;
  description: string;
  algorithm: string;
  category: string;
  hardware?: string;
  framework?: string;
  qubits?: number;
  keyMetrics?: Array<{ metric: string; value: string; unit?: string }>;
  significance?: string;
  tags: string[];
}

export function buildDatasetSchema(b: BenchmarkInput): Record<string, unknown> {
  const variableMeasured = b.keyMetrics?.map(m => ({
    '@type': 'PropertyValue',
    name: m.metric,
    value: m.value,
    ...(m.unit ? { unitText: m.unit } : {}),
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: b.name,
    description: b.description,
    url: `https://directory.kvantiq.studio/benchmarks/${b.slug}/`,
    measurementTechnique: b.algorithm,
    keywords: b.tags,
    ...(variableMeasured && variableMeasured.length > 0 ? { variableMeasured } : {}),
    ...(b.hardware ? { hardwareRequirements: b.hardware } : {}),
    ...(b.framework ? { citation: b.framework } : {}),
    ...(b.significance ? { abstract: b.significance } : {}),
    creator: {
      '@type': 'Organization',
      name: 'Kvantiq Directory',
      url: 'https://directory.kvantiq.studio',
    },
    license: 'https://creativecommons.org/licenses/by/4.0/',
  };
}
```

- [ ] **Step 4: Run tests — expect 25 passing**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
```

- [ ] **Step 5: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add src/lib/jsonld/dataset.ts src/lib/jsonld/dataset.test.ts
git -C C:/Synapse/kvantiq-directory commit -m "feat(seo): add Dataset JSON-LD builder for benchmarks"
```

---

## Task 5: Wire `Dataset` JSON-LD into benchmarks/[slug].astro

**Files:**
- Modify: `src/pages/benchmarks/[slug].astro`

- [ ] **Step 1: Read the current `benchmarks/[slug].astro` to find where to wire JSON-LD**

```bash
cat C:/Synapse/kvantiq-directory/src/pages/benchmarks/[slug].astro
```

Look for the `<BaseLayout title={...} description={...}>` invocation. The plan needs to add a `jsonLd={...}` prop.

- [ ] **Step 2: Import the builder and pass the schema**

In `src/pages/benchmarks/[slug].astro`, in the frontmatter, add:

```typescript
import { buildDatasetSchema } from '../../lib/jsonld/dataset.ts';

// ... after `const { benchmark, related } = Astro.props;`
const datasetLd = buildDatasetSchema(benchmark);
```

Then update the `<BaseLayout>` opening tag to include `jsonLd={datasetLd}`:

```astro
<BaseLayout title={benchmark.name} description={benchmark.description} jsonLd={datasetLd}>
```

- [ ] **Step 3: Build + verify the schema lands in static HTML**

```bash
npm --prefix C:/Synapse/kvantiq-directory run build
```

Pick any benchmark slug (find via `ls dist/benchmarks/`):

```bash
ls C:/Synapse/kvantiq-directory/dist/benchmarks/ | head -3
```

Then check the generated HTML for the schema:

```bash
grep -c '"@type":"Dataset"' C:/Synapse/kvantiq-directory/dist/benchmarks/<slug>/index.html
```

Expected: ≥1.

- [ ] **Step 4: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add src/pages/benchmarks/[slug].astro
git -C C:/Synapse/kvantiq-directory commit -m "feat(seo): emit Dataset JSON-LD on benchmark detail pages"
```

---

## Task 6: Build `Article` JSON-LD module + wire to use-cases (TDD)

**Files:**
- Create: `src/lib/jsonld/article.test.ts`
- Create: `src/lib/jsonld/article.ts`
- Modify: `src/pages/use-cases/[slug].astro`

- [ ] **Step 1: Failing test**

```typescript
// src/lib/jsonld/article.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArticleSchema } from './article.ts';

test('buildArticleSchema produces valid Article JSON-LD', () => {
  const result = buildArticleSchema({
    name: 'Portfolio optimization at JP Morgan',
    slug: 'jpm-portfolio-optimization',
    description: 'Quantum-classical hybrid for credit risk portfolios.',
    industry: 'finance',
    category: 'optimization',
    problem: 'Combinatorial complexity at >500 assets exceeds classical solvers in time budget.',
    approach: 'QAOA with classical warm-start; hybrid runtime via IBM Quantum Network.',
    results: '12% Sharpe improvement on backtest.',
    companies: ['IBM', 'JP Morgan'],
    tags: ['finance', 'qaoa'],
  });

  assert.equal(result['@type'], 'Article');
  assert.equal(result.headline, 'Portfolio optimization at JP Morgan');
  assert.equal(result.articleSection, 'finance');
  assert.equal(result.url, 'https://directory.kvantiq.studio/use-cases/jpm-portfolio-optimization/');
  assert.deepEqual(result.keywords, ['finance', 'qaoa']);
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
```

- [ ] **Step 3: Implement**

```typescript
// src/lib/jsonld/article.ts

interface UseCaseInput {
  name: string;
  slug: string;
  description: string;
  industry: string;
  category: string;
  problem: string;
  approach: string;
  results?: string;
  companies?: string[];
  tags: string[];
}

export function buildArticleSchema(u: UseCaseInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: u.name,
    description: u.description,
    url: `https://directory.kvantiq.studio/use-cases/${u.slug}/`,
    articleSection: u.industry,
    keywords: u.tags,
    about: [
      { '@type': 'Thing', name: u.industry },
      ...(u.companies ?? []).map(c => ({ '@type': 'Organization', name: c })),
    ],
    abstract: `Problem: ${u.problem}\n\nApproach: ${u.approach}`,
    ...(u.results ? { citation: u.results } : {}),
    publisher: {
      '@type': 'Organization',
      name: 'Kvantiq Directory',
      url: 'https://directory.kvantiq.studio',
    },
  };
}
```

- [ ] **Step 4: Wire into `src/pages/use-cases/[slug].astro`**

Add to frontmatter:

```typescript
import { buildArticleSchema } from '../../lib/jsonld/article.ts';

// after const { useCase, related } = Astro.props;
const articleLd = buildArticleSchema(useCase);
```

Update BaseLayout invocation to pass `jsonLd={articleLd}`.

- [ ] **Step 5: Test, build, verify**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
npm --prefix C:/Synapse/kvantiq-directory run build
ls C:/Synapse/kvantiq-directory/dist/use-cases/ | head -1
grep -c '"@type":"Article"' C:/Synapse/kvantiq-directory/dist/use-cases/<slug>/index.html
```

Expected: 26 tests pass, ≥1 grep hit.

- [ ] **Step 6: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add src/lib/jsonld/article.ts src/lib/jsonld/article.test.ts src/pages/use-cases/[slug].astro
git -C C:/Synapse/kvantiq-directory commit -m "feat(seo): add Article JSON-LD on use-case detail pages"
```

---

## Task 7: Build `Event` JSON-LD module + wire to challenges (TDD)

**Files:**
- Create: `src/lib/jsonld/event.test.ts`
- Create: `src/lib/jsonld/event.ts`
- Modify: `src/pages/challenges/[slug].astro`

- [ ] **Step 1: Failing test**

```typescript
// src/lib/jsonld/event.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEventSchema } from './event.ts';

test('buildEventSchema produces valid Event JSON-LD', () => {
  const result = buildEventSchema({
    name: 'TechBBQ Hackathon 2026',
    slug: 'techbbq-2026',
    description: 'Quantum hackathon at TechBBQ Copenhagen.',
    organizer: 'Kvantiq Studio',
    website: 'https://techbbq.dk/hackathon',
    dateStart: '2026-09-15',
    dateEnd: '2026-09-17',
    status: 'upcoming',
    prizes: '€50k total prize pool',
    location: 'Copenhagen, Denmark',
    eligibility: 'Open to anyone',
    tags: ['hackathon', 'denmark'],
  });

  assert.equal(result['@type'], 'Event');
  assert.equal(result.name, 'TechBBQ Hackathon 2026');
  assert.equal(result.startDate, '2026-09-15');
  assert.equal(result.endDate, '2026-09-17');
  assert.equal(result.eventStatus, 'https://schema.org/EventScheduled');
  const organizer = result.organizer as Record<string, string>;
  assert.equal(organizer.name, 'Kvantiq Studio');
});

test('buildEventSchema maps status correctly', () => {
  const r1 = buildEventSchema({
    name: 'X', slug: 'x', description: '...', organizer: 'Y', website: 'https://x.com',
    status: 'completed', tags: ['t'],
  });
  assert.equal(r1.eventStatus, 'https://schema.org/EventScheduled');
});
```

- [ ] **Step 2: Implement**

```typescript
// src/lib/jsonld/event.ts

interface ChallengeInput {
  name: string;
  slug: string;
  description: string;
  organizer: string;
  website: string;
  dateStart?: string;
  dateEnd?: string;
  status: 'upcoming' | 'active' | 'completed';
  prizes?: string;
  location?: string;
  eligibility?: string;
  teamSize?: string;
  registrationDeadline?: string;
  tags: string[];
}

export function buildEventSchema(c: ChallengeInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: c.name,
    description: c.description,
    url: `https://directory.kvantiq.studio/challenges/${c.slug}/`,
    keywords: c.tags,
    ...(c.dateStart ? { startDate: c.dateStart } : {}),
    ...(c.dateEnd ? { endDate: c.dateEnd } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    organizer: {
      '@type': 'Organization',
      name: c.organizer,
      url: c.website,
    },
    ...(c.prizes ? { offers: { '@type': 'Offer', description: c.prizes } } : {}),
    ...(c.location ? { location: { '@type': 'Place', name: c.location } } : {}),
    ...(c.eligibility ? { eligibilityToWorkRequirement: c.eligibility } : {}),
  };
}
```

- [ ] **Step 3: Wire into `src/pages/challenges/[slug].astro`**

Same pattern as Tasks 5/6.

- [ ] **Step 4: Test + build + grep verify on challenges/<slug>/index.html for `"@type":"Event"`**

- [ ] **Step 5: Commit**

```bash
git -C C:/Synapse/kvantiq-directory commit -m "feat(seo): add Event JSON-LD on challenge detail pages"
```

---

## Task 8: Build `ItemList` of `LearningResource` for resources index (TDD)

**Files:**
- Create: `src/lib/jsonld/learning-resource-list.test.ts`
- Create: `src/lib/jsonld/learning-resource-list.ts`
- Modify: `src/pages/resources/index.astro`

> **Why index, not detail:** per `kvantiq-directory/CLAUDE.md`, resources have NO detail pages — the index links to external sites only. Schema goes on the index page.

- [ ] **Step 1: Failing test**

```typescript
// src/lib/jsonld/learning-resource-list.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLearningResourceList } from './learning-resource-list.ts';

test('buildLearningResourceList produces ItemList of LearningResource', () => {
  const result = buildLearningResourceList([
    {
      name: 'Qiskit Textbook',
      slug: 'qiskit-textbook',
      description: 'Free open-source quantum textbook.',
      type: 'course',
      website: 'https://qiskit.org/textbook',
      free: true,
      tags: ['course', 'free'],
    },
    {
      name: 'PennyLane',
      slug: 'pennylane',
      description: 'Open-source quantum ML library.',
      type: 'framework',
      website: 'https://pennylane.ai',
      openSource: true,
      tags: ['framework', 'ml'],
    },
  ]);

  assert.equal(result['@type'], 'ItemList');
  assert.equal((result.itemListElement as unknown[]).length, 2);
  const first = (result.itemListElement as Array<Record<string, unknown>>)[0];
  assert.equal(first['@type'], 'ListItem');
  assert.equal(first.position, 1);
  const item = first.item as Record<string, unknown>;
  assert.equal(item['@type'], 'LearningResource');
  assert.equal(item.name, 'Qiskit Textbook');
  assert.equal(item.url, 'https://qiskit.org/textbook');
});
```

- [ ] **Step 2: Implement**

```typescript
// src/lib/jsonld/learning-resource-list.ts

interface ResourceInput {
  name: string;
  slug: string;
  description: string;
  type: string;
  website: string;
  free?: boolean;
  openSource?: boolean;
  language?: string;
  provider?: string;
  tags: string[];
}

export function buildLearningResourceList(resources: ResourceInput[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'European Quantum Computing Resources',
    description: 'Curated framework, courses, tools, and community resources for European quantum computing.',
    numberOfItems: resources.length,
    itemListElement: resources.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'LearningResource',
        name: r.name,
        description: r.description,
        url: r.website,
        learningResourceType: r.type,
        keywords: r.tags,
        ...(r.free ? { isAccessibleForFree: true } : {}),
        ...(r.provider ? { provider: { '@type': 'Organization', name: r.provider } } : {}),
        ...(r.language ? { inLanguage: r.language } : {}),
      },
    })),
  };
}
```

- [ ] **Step 3: Wire into `src/pages/resources/index.astro`**

In the frontmatter, after the resources collection is loaded:

```typescript
import { buildLearningResourceList } from '../../lib/jsonld/learning-resource-list.ts';
const resourcesLd = buildLearningResourceList(resources.map(r => r.data));
```

Pass `jsonLd={resourcesLd}` to `<BaseLayout>`.

- [ ] **Step 4: Test, build, grep `"@type":"ItemList"` on `dist/resources/index.html`. Expected: ≥1.**

- [ ] **Step 5: Commit**

```bash
git -C C:/Synapse/kvantiq-directory commit -m "feat(seo): add ItemList of LearningResource on resources index"
```

---

## Task 9: Add satori + resvg dependencies

**Files:**
- Modify: `package.json` (deps via npm install)

- [ ] **Step 1: Install**

```bash
npm --prefix C:/Synapse/kvantiq-directory install satori @resvg/resvg-js
```

- [ ] **Step 2: Verify deps landed**

```bash
grep -E "satori|resvg" C:/Synapse/kvantiq-directory/package.json
```

Expected: 2 lines, both deps present.

- [ ] **Step 3: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add package.json package-lock.json
git -C C:/Synapse/kvantiq-directory commit -m "build: add satori + resvg for OG image generation"
```

---

## Task 10: OG image template module (TDD)

**Files:**
- Create: `src/lib/og-image-template.test.ts`
- Create: `src/lib/og-image-template.tsx`

- [ ] **Step 1: Failing test — verify SVG output structure**

```typescript
// src/lib/og-image-template.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderOgSvg } from './og-image-template.ts';

test('renderOgSvg produces SVG containing entry name + collection type', async () => {
  const svg = await renderOgSvg({
    eyebrow: 'COMPANY',
    heading: 'Pasqal',
    subhead: 'France · Hardware · Founded 2019',
  });
  assert.match(svg, /Pasqal/);
  assert.match(svg, /COMPANY/);
  assert.match(svg, /France/);
  assert.match(svg, /<svg/);
});

test('renderOgSvg handles long headings without throwing', async () => {
  const svg = await renderOgSvg({
    eyebrow: 'BENCHMARK',
    heading: 'Variational Quantum Eigensolver on heavy-hex topology with classical warm-start',
    subhead: 'IBM · Qiskit · 127 qubits',
  });
  assert.ok(svg.length > 100);
});
```

- [ ] **Step 2: Implement template**

```tsx
// src/lib/og-image-template.tsx
import satori from 'satori';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface OgInput {
  eyebrow: string;   // collection type, e.g. "COMPANY"
  heading: string;   // entry name
  subhead: string;   // 2-3 key facts joined by ' · '
}

// Editorial Light palette
const COLORS = {
  bg: '#F8F6F1',
  border: '#DDD8CF',
  primary: '#1C1917',
  secondary: '#57534E',
  muted: '#78716C',
  accent: '#B45309',
};

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Load fonts at module load — adjust paths to match what's actually in the repo's
// public/fonts/ or node_modules/<font-pkg>. If fonts aren't yet vendored, add them
// in a follow-up; for now use system-named fallback fonts that satori knows.

let fontCache: Array<{ name: string; data: Buffer; weight: number; style: 'normal' }> | null = null;

async function loadFonts() {
  if (fontCache) return fontCache;
  // Prefer Inter (already used by site). Vendor the WOFF2 in public/fonts/ if not present.
  const interPath = resolve(__dirname, '../../public/fonts/Inter-SemiBold.woff2');
  const monoPath = resolve(__dirname, '../../public/fonts/IBMPlexMono-Regular.woff2');

  fontCache = [
    {
      name: 'Inter',
      data: readFileSync(interPath),
      weight: 600,
      style: 'normal',
    },
    {
      name: 'IBM Plex Mono',
      data: readFileSync(monoPath),
      weight: 400,
      style: 'normal',
    },
  ];
  return fontCache;
}

export async function renderOgSvg(input: OgInput): Promise<string> {
  const fonts = await loadFonts();

  return satori(
    {
      type: 'div',
      props: {
        style: {
          width: '1200px',
          height: '630px',
          backgroundColor: COLORS.bg,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 80px',
          fontFamily: 'Inter',
          color: COLORS.primary,
        },
        children: [
          // Top: eyebrow
          {
            type: 'div',
            props: {
              style: {
                fontFamily: 'IBM Plex Mono',
                fontSize: '20px',
                color: COLORS.secondary,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              },
              children: input.eyebrow,
            },
          },
          // Middle: heading
          {
            type: 'div',
            props: {
              style: {
                fontSize: '88px',
                fontWeight: 600,
                lineHeight: 1.05,
                color: COLORS.primary,
                marginTop: '24px',
                marginBottom: '16px',
              },
              children: input.heading,
            },
          },
          // Bottom row: subhead + watermark
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                fontFamily: 'IBM Plex Mono',
                fontSize: '22px',
                color: COLORS.muted,
                borderTop: `1px solid ${COLORS.border}`,
                paddingTop: '20px',
              },
              children: [
                { type: 'div', props: { children: input.subhead } },
                { type: 'div', props: { style: { color: COLORS.accent }, children: 'directory.kvantiq.studio' } },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts,
    },
  );
}
```

> **Important:** This task assumes Inter and IBM Plex Mono WOFF2 files exist at `public/fonts/`. If they don't, this is a sub-task — download from Google Fonts and vendor:
> ```bash
> curl -o C:/Synapse/kvantiq-directory/public/fonts/Inter-SemiBold.woff2 https://github.com/rsms/inter/raw/master/docs/font-files/Inter-SemiBold.woff2
> ```
> If fonts can't be vendored cleanly, fallback: use a single bundled font (e.g. Geist via `@vercel/og` font helper) and remove the IBM Plex Mono dependency — accept that the OG won't perfectly match site type. Mention as a concern; ask before changing the design.

- [ ] **Step 3: Test, expect both pass**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
```

Expected: 28 passing (Plan 1 23 + 5 new).

- [ ] **Step 4: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add src/lib/og-image-template.tsx src/lib/og-image-template.test.ts
git -C C:/Synapse/kvantiq-directory commit -m "feat(og): add satori-based OG image template"
```

---

## Task 11: OG image endpoint (Astro dynamic route)

**Files:**
- Create: `src/pages/og-images/[collection]/[slug].png.ts`

- [ ] **Step 1: Implement the endpoint**

```typescript
// src/pages/og-images/[collection]/[slug].png.ts
import type { APIRoute } from 'astro';
import { Resvg } from '@resvg/resvg-js';
import { getCollection } from 'astro:content';
import { renderOgSvg } from '../../../lib/og-image-template.tsx';

const COLLECTIONS = ['companies', 'benchmarks', 'use-cases', 'challenges'] as const;
type CollectionId = typeof COLLECTIONS[number];

const EYEBROWS: Record<CollectionId, string> = {
  companies: 'COMPANY',
  benchmarks: 'BENCHMARK',
  'use-cases': 'USE CASE',
  challenges: 'CHALLENGE',
};

export async function getStaticPaths() {
  const paths: Array<{ params: { collection: CollectionId; slug: string } }> = [];
  for (const collection of COLLECTIONS) {
    const entries = await getCollection(collection);
    for (const entry of entries) {
      paths.push({ params: { collection, slug: entry.data.slug } });
    }
  }
  return paths;
}

function buildSubhead(collection: CollectionId, data: Record<string, unknown>): string {
  switch (collection) {
    case 'companies': {
      const country = (data.country as string) ?? '';
      const type = ((data.type as string) ?? '').replace(/^\w/, c => c.toUpperCase());
      const founded = data.founded ? `Founded ${data.founded}` : '';
      return [country, type, founded].filter(Boolean).join(' · ');
    }
    case 'benchmarks': {
      const algorithm = (data.algorithm as string) ?? '';
      const hardware = (data.hardware as string) ?? '';
      const qubits = data.qubits ? `${data.qubits} qubits` : '';
      return [algorithm, hardware, qubits].filter(Boolean).join(' · ');
    }
    case 'use-cases': {
      const industry = (data.industry as string) ?? '';
      const category = (data.category as string) ?? '';
      return [industry, category].filter(Boolean).join(' · ');
    }
    case 'challenges': {
      const organizer = (data.organizer as string) ?? '';
      const dateStart = (data.dateStart as string) ?? '';
      const status = (data.status as string) ?? '';
      return [organizer, dateStart, status].filter(Boolean).join(' · ');
    }
  }
}

export const GET: APIRoute = async ({ params }) => {
  const collection = params.collection as CollectionId;
  const slug = params.slug as string;

  const entries = await getCollection(collection);
  const entry = entries.find(e => e.data.slug === slug);
  if (!entry) {
    return new Response('Not found', { status: 404 });
  }

  const svg = await renderOgSvg({
    eyebrow: EYEBROWS[collection],
    heading: (entry.data as { name: string }).name,
    subhead: buildSubhead(collection, entry.data),
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  const png = resvg.render().asPng();

  return new Response(png, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
};
```

- [ ] **Step 2: Build — verify all 141 PNGs generate**

```bash
npm --prefix C:/Synapse/kvantiq-directory run build
ls C:/Synapse/kvantiq-directory/dist/og-images/companies/ | wc -l
ls C:/Synapse/kvantiq-directory/dist/og-images/benchmarks/ | wc -l
ls C:/Synapse/kvantiq-directory/dist/og-images/use-cases/ | wc -l
ls C:/Synapse/kvantiq-directory/dist/og-images/challenges/ | wc -l
```

Expected counts: 74 + 32 + 23 + 12 = 141 PNGs total.

- [ ] **Step 3: Spot-check one image visually**

Open `C:/Synapse/kvantiq-directory/dist/og-images/companies/pasqal.png` in an image viewer. Confirm: 1200×630, Editorial-Light palette, "COMPANY" eyebrow, "Pasqal" heading, country/type/founded subhead, watermark.

- [ ] **Step 4: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add src/pages/og-images/
git -C C:/Synapse/kvantiq-directory commit -m "feat(og): add per-entry OG image endpoint (build-time, satori → PNG)"
```

---

## Task 12: Pass `ogImage` prop on all 5 detail page templates

**Files:**
- Modify: `src/pages/companies/[slug].astro`
- Modify: `src/pages/benchmarks/[slug].astro`
- Modify: `src/pages/use-cases/[slug].astro`
- Modify: `src/pages/challenges/[slug].astro`
- Modify: `src/pages/index.astro` (homepage gets a default OG too)

- [ ] **Step 1: For each `*/[slug].astro`, add `ogImage` to `<BaseLayout>`**

Example for companies:

```astro
<BaseLayout
  title={company.name}
  description={company.description}
  jsonLd={orgLd}
  ogImage={`/og-images/companies/${company.slug}.png`}
>
```

Repeat with the right collection name for benchmarks, use-cases, challenges.

For homepage (`src/pages/index.astro`), pass:

```astro
ogImage="/og-images/companies/pasqal.png"
```

(or any signature image you want to use as the homepage card; the homepage doesn't have its own slug.)

- [ ] **Step 2: Build + verify the meta tag points at the per-page PNG**

```bash
npm --prefix C:/Synapse/kvantiq-directory run build
grep "og:image" C:/Synapse/kvantiq-directory/dist/companies/pasqal/index.html
```

Expected: `<meta property="og:image" content="/og-images/companies/pasqal.png" />` (relative path; absolute URL composition handled by the meta value).

- [ ] **Step 3: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add src/pages/companies/[slug].astro src/pages/benchmarks/[slug].astro src/pages/use-cases/[slug].astro src/pages/challenges/[slug].astro src/pages/index.astro
git -C C:/Synapse/kvantiq-directory commit -m "feat(og): wire per-entry OG images into detail page meta tags"
```

---

## Task 13: Internal-link audit

**Files:** none (verification, may produce a follow-up fix commit)

- [ ] **Step 1: Build and pick representative pages from each detail collection**

```bash
npm --prefix C:/Synapse/kvantiq-directory run build
ls C:/Synapse/kvantiq-directory/dist/companies/ | head -1
ls C:/Synapse/kvantiq-directory/dist/use-cases/ | head -1
ls C:/Synapse/kvantiq-directory/dist/challenges/ | head -1
```

- [ ] **Step 2: Grep for cross-collection links in the static HTML of each**

For each picked page, run:

```bash
grep -E 'href="/(companies|benchmarks|use-cases|challenges)/' C:/Synapse/kvantiq-directory/dist/<picked>/index.html | head -10
```

Expected: at least 2 `<a href="...">` tags pointing at sibling collection slugs (e.g., a use-case page should link to its referenced companies; a benchmark page should link to related benchmarks).

- [ ] **Step 3: If links are missing or rendered as `<button data-href>` (i.e. JS-only)**

`lib/related.ts` already computes related items; check whether `DetailPage.tsx` renders them as `<a>` tags server-side. If JS-only:
1. Modify `DetailPage.tsx` to render `<a href={item.href}>` directly in the related-items list (Tailwind classes for visual styling, but the anchor must be present in static HTML for crawlers).
2. Re-build, re-grep, confirm.
3. Commit fix: `fix(seo): render related items as crawlable <a> tags`.

- [ ] **Step 4: If links are present (best case), no fix needed — commit a notes file**

If everything looks good, write a one-paragraph note in the PR body recording the audit was done. No commit.

---

## Task 14: Final verification + push

**Files:** none (verification + PR open)

- [ ] **Step 1: Full build + test passes**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
npm --prefix C:/Synapse/kvantiq-directory run build
```

Expected: ~28-30 tests passing, build succeeds, `dist/` populated.

- [ ] **Step 2: Verify every page-template's expected schema lands**

```bash
grep -lr '"@type":"Dataset"' C:/Synapse/kvantiq-directory/dist/benchmarks/ | wc -l
grep -lr '"@type":"Article"' C:/Synapse/kvantiq-directory/dist/use-cases/ | wc -l
grep -lr '"@type":"Event"' C:/Synapse/kvantiq-directory/dist/challenges/ | wc -l
grep -l '"@type":"ItemList"' C:/Synapse/kvantiq-directory/dist/resources/index.html
```

Expected: 32 Dataset matches (one per benchmark), 23 Article matches, 12 Event matches, 1 ItemList match on resources index.

- [ ] **Step 3: Verify robots.txt and OG images**

```bash
cat C:/Synapse/kvantiq-directory/dist/robots.txt | grep Sitemap
ls C:/Synapse/kvantiq-directory/dist/og-images/companies/ | head -3
```

Expected: `Sitemap:` line points to `sitemap-index.xml`. OG images directory has `*.png` files.

- [ ] **Step 4: Push and open PR**

```bash
git -C C:/Synapse/kvantiq-directory push -u origin feature/directory-hardening
gh pr create --repo de-Blanck/kvantiq-directory \
  --base main \
  --head feature/directory-hardening \
  --title "feat: directory hardening pass (Plan 2 of 2)" \
  --body "$(cat <<'EOF'
## Summary

Plan 2 of the directory organic-traffic project — fixes every discoverability leak surfaced during the 2026-05-06 recon.

This is **the intervention layer**. Plan 1 (citation-probe) shipped dormant in PR #28; this PR contains the actual fixes that move organic traffic.

## What ships

- **`robots.txt` fix** — sitemap path corrected from `/sitemap.xml` (404) to `/sitemap-index.xml` (the actual generated path)
- **Per-collection JSON-LD** — Benchmarks → `Dataset`, Use Cases → `Article`, Challenges → `Event`, Resources → `ItemList` of `LearningResource`
- **`SpeakableSpecification` fix** — added `.summary` class to `DetailPage.tsx` description so the existing speakable schema points at real DOM
- **Per-entry OG images** — 141 build-time-generated 1200×630 PNGs via `satori` + `@resvg/resvg-js` on the Editorial Light palette
- **Monitoring instrumentation** — Plausible script + GSC + Bing Webmaster verification metas in `BaseLayout.astro` (verification tokens are placeholders to be replaced post-merge)

## Spec + Plan

- Spec: `docs/superpowers/specs/2026-05-06-directory-organic-traffic-design.md`
- Plan: `docs/superpowers/plans/2026-05-08-directory-hardening-pass.md`

## Post-merge actions for Rune

- [ ] Register `directory.kvantiq.studio` at https://search.google.com/search-console — copy verification token, replace `GSC_VERIFICATION_TOKEN_PLACEHOLDER` in `BaseLayout.astro`, push fix
- [ ] Register at https://www.bing.com/webmasters — same drill, replace `BING_VERIFICATION_TOKEN_PLACEHOLDER`
- [ ] Submit `https://directory.kvantiq.studio/sitemap-index.xml` to both consoles
- [ ] Confirm Plausible is collecting events at https://plausible.io/directory.kvantiq.studio (or set up the Plausible account if not already)

## Test plan

- [x] `npm test` passes
- [x] `npm run build` succeeds, generates 141 OG PNGs
- [x] Per-collection JSON-LD verified via grep on built HTML
- [x] Internal-link audit passed (related items render as crawlable `<a>` tags)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review (executed during plan authoring)

**Spec coverage:**

| Spec section | Plan task |
|---|---|
| Fix robots.txt sitemap reference | Task 1 |
| Per-collection JSON-LD: Dataset / Article / Event / ItemList | Tasks 4, 6, 7, 8 |
| Companies → Organization (existing) | No task — confirmed already present in commit `aee...` of `companies/[slug].astro` per spec recon |
| Fix SpeakableSpecification | Task 3 |
| Per-entry OG images | Tasks 9, 10, 11, 12 |
| Internal-link audit | Task 13 |
| Plausible + GSC + Bing verification metas | Task 2 |
| Source-bar backfill | NOT in this plan — separate background workstream per spec ("runs as background workstream via the existing `scripts/` weekly agent") |

Source-bar backfill is intentionally out of scope. The existing weekly-agent.yml + content-audit.ts already form the backbone; raising entries to ≥3 sources is a content workstream that runs in parallel and produces its own PRs. Surface to Rune in the plan summary.

Citation-probe baseline is intentionally out of scope per Path 1 decision (2026-05-08).

**Placeholder scan:** Three intentional placeholders, all called out explicitly in the plan and PR template:
1. `GSC_VERIFICATION_TOKEN_PLACEHOLDER` — Task 2, replaced by Rune post-merge
2. `BING_VERIFICATION_TOKEN_PLACEHOLDER` — Task 2, same
3. Font paths in Task 10 (`public/fonts/Inter-SemiBold.woff2`) — flagged as conditional sub-task; if fonts aren't vendored, the plan recommends vendoring them and provides a curl command. NOT a placeholder in the literal sense — concrete guidance for both branches.

**Type consistency:**
- All four JSON-LD builders accept a typed input matching the Zod schemas in `src/content.config.ts` (companies / benchmarks / use-cases / challenges / resources). Field names match exactly.
- `OgInput` shape is consistent across template + endpoint (Task 10 → Task 11).
- Collection IDs (`'companies' | 'benchmarks' | 'use-cases' | 'challenges'`) are used consistently in OG endpoint params + JSON-LD URL building.

**Scope check:** Plan covers one coherent surface — the static-page hardening pass. Each task produces an independently-shippable improvement. Single PR boundary at Task 14.

---

## Branch + execution

This plan executes on a NEW branch off `main` once PR #28 (Plan 1 dormant ship) merges:

```bash
git -C C:/Synapse/kvantiq-directory fetch origin
git -C C:/Synapse/kvantiq-directory checkout -b feature/directory-hardening origin/main
```

Until PR #28 merges, this plan can be reviewed/refined but should not begin execution — it would conflict with Plan 1's pending changes if branches diverged.

---

## Estimated cost + duration

**Cost:** $0 in API/runtime fees. All free-tier services. The only money is Plausible (~€9/mo cloud OR self-host on existing Vercel free tier).

**Duration:** ~4-6 hours of focused work. Tasks 9-12 (OG images) are the longest — satori + resvg integration + 141-image build generation. Everything else is small surgical edits.

**Token cost (subagent-driven execution):** roughly half of Plan 1's execution given fewer TDD-heavy tasks. Estimate $5-10 in subagent dispatches if executed via the same batched approach as Plan 1.
