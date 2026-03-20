# Kvantiq Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static directory site for European quantum computing companies, benchmarks, use cases, challenges, and resources — optimized for Google SEO and AI/LLM discoverability.

**Architecture:** Astro static site with JSON data in Content Collections, Tailwind CSS styling, Pagefind search, deployed to Vercel free tier. All data is schema-validated at build time with Zod. Every page outputs semantic HTML5 with JSON-LD structured data for AI crawler extraction.

**Tech Stack:** Astro 5+, Tailwind CSS 4, Pagefind, @astrojs/sitemap, Zod, Vercel

**Spec:** `docs/superpowers/specs/2026-03-18-kvantiq-directory-design.md`

**Working directory:** `E:/kvantiq-directory/.worktrees/feature-directory-site`

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `src/styles/global.css`

- [ ] **Step 1: Initialize Astro project**

Run from the worktree root:
```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
npm create astro@latest . -- --template minimal --no-install --no-git
```

If prompted about overwriting, allow it (we only have docs/ which won't be overwritten).

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

- [ ] **Step 3: Add Tailwind CSS**

```bash
npx astro add tailwind
```

Accept all defaults. This installs the Vite Tailwind plugin and creates `src/styles/global.css` with the Tailwind import.

- [ ] **Step 4: Add sitemap integration**

```bash
npx astro add sitemap
```

- [ ] **Step 5: Configure astro.config.mjs**

Update `astro.config.mjs` to:

```javascript
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://kvantiq.com',
  integrations: [sitemap(), tailwind()],
  output: 'static',
});
```

Note: If Tailwind 4 was installed (via Vite plugin, not @astrojs/tailwind), the config will look different — the `astro add tailwind` output will tell you. Follow what it says.

- [ ] **Step 6: Verify build works**

```bash
npx astro build
```

Expected: Build succeeds with default index page.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: initialize Astro project with Tailwind and sitemap"
```

---

## Task 2: Content Collections Schemas

**Files:**
- Create: `src/content.config.ts`


Note: Content directories will be created in Task 3 when we add sample data. Astro Content Collections only need the `content.config.ts` file to exist.

- [ ] **Step 1: Create content.config.ts with all collection schemas**

Create `src/content.config.ts`:

```typescript
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const companies = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/companies' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    country: z.string(),
    region: z.enum(['nordics', 'dach', 'western-europe', 'southern-europe', 'eastern-europe', 'uk']),
    type: z.enum(['hardware', 'software', 'cloud', 'consulting', 'research', 'hybrid', 'other']),
    tags: z.array(z.string()),
    founded: z.number().optional(),
    description: z.string(),
    website: z.string().url(),
    featured: z.boolean().default(false),
    logo: z.string().optional(),
    headquarters: z.string().optional(),
    employees: z.string().optional(),
    funding: z.string().optional(),
  }),
});

const benchmarks = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/benchmarks' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    algorithm: z.string(),
    category: z.enum(['optimization', 'simulation', 'machine-learning', 'cryptography', 'chemistry', 'other']),
    tags: z.array(z.string()),
    description: z.string(),
    hardware: z.string().optional(),
    framework: z.string().optional(),
    qubits: z.number().optional(),
    source: z.string().url().optional(),
    reproducible: z.boolean().default(false),
    datePublished: z.string().optional(),
  }),
});

const useCases = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/use-cases' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    industry: z.string(),
    category: z.enum(['optimization', 'simulation', 'machine-learning', 'cryptography', 'chemistry', 'finance', 'logistics', 'energy', 'other']),
    tags: z.array(z.string()),
    description: z.string(),
    problem: z.string(),
    approach: z.string(),
    results: z.string().optional(),
    companies: z.array(z.string()).optional(),
    source: z.string().url().optional(),
  }),
});

const challenges = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/challenges' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    organizer: z.string(),
    tags: z.array(z.string()),
    description: z.string(),
    website: z.string().url(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
    status: z.enum(['upcoming', 'active', 'completed']).default('completed'),
    prizes: z.string().optional(),
    location: z.string().optional(),
  }),
});

const resources = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/resources' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    type: z.enum(['framework', 'course', 'funding', 'tool', 'community', 'publication', 'other']),
    tags: z.array(z.string()),
    description: z.string(),
    website: z.string().url(),
    openSource: z.boolean().default(false),
    free: z.boolean().default(false),
    language: z.string().optional(),
    provider: z.string().optional(),
  }),
});

export const collections = { companies, benchmarks, 'use-cases': useCases, challenges, resources };
```

- [ ] **Step 2: Verify build with schemas**

```bash
npx astro build
```

Expected: Build succeeds. Content Collections are validated.

- [ ] **Step 3: Commit**

```bash
git add src/content.config.ts
git commit -m "feat: add Content Collections schemas for all data types"
```

---

## Task 3: Sample Data for Development

**Files:**
- Create: `src/content/companies/iqm.json`
- Create: `src/content/companies/pasqal.json`
- Create: `src/content/companies/planqc.json`
- Create: `src/content/benchmarks/vqe-hydrogen.json`
- Create: `src/content/benchmarks/qaoa-maxcut.json`
- Create: `src/content/use-cases/drug-discovery-hybrid.json`
- Create: `src/content/use-cases/portfolio-optimization.json`
- Create: `src/content/challenges/qhack-2025.json`
- Create: `src/content/resources/pennylane.json`
- Create: `src/content/resources/qiskit.json`

- [ ] **Step 1: Create 3 company entries**

`src/content/companies/iqm.json`:
```json
{
  "name": "IQM Quantum Computers",
  "slug": "iqm",
  "country": "Finland",
  "region": "nordics",
  "type": "hardware",
  "tags": ["superconducting", "hybrid", "EuroHPC", "full-stack"],
  "founded": 2018,
  "description": "IQM Quantum Computers is a European leader in building superconducting quantum computers. Based in Finland, IQM provides on-premises quantum computers and partners with EuroHPC to integrate quantum accelerators into European supercomputing centers. IQM focuses on application-specific co-design for industrial quantum advantage.",
  "website": "https://www.meetiqm.com",
  "featured": true,
  "headquarters": "Espoo, Finland",
  "employees": "250+",
  "funding": "EUR 200M+"
}
```

`src/content/companies/pasqal.json`:
```json
{
  "name": "Pasqal",
  "slug": "pasqal",
  "country": "France",
  "region": "western-europe",
  "type": "hardware",
  "tags": ["neutral-atom", "hybrid", "EuroHPC", "quantum-simulation"],
  "founded": 2019,
  "description": "Pasqal builds neutral-atom quantum processors for solving real-world optimization and simulation problems. Founded by pioneers of cold atom physics including Alain Aspect (Nobel laureate), Pasqal delivers quantum computing solutions to enterprise clients in energy, automotive, and finance.",
  "website": "https://www.pasqal.com",
  "featured": true,
  "headquarters": "Massy, France",
  "employees": "200+",
  "funding": "EUR 100M+"
}
```

`src/content/companies/planqc.json`:
```json
{
  "name": "planqc",
  "slug": "planqc",
  "country": "Germany",
  "region": "dach",
  "type": "hardware",
  "tags": ["neutral-atom", "quantum-simulation", "optical-lattice"],
  "founded": 2022,
  "description": "planqc is a German quantum computing startup developing atom-based quantum computers using optical lattices. Spun out of the Max Planck Institute of Quantum Optics, planqc aims to build scalable quantum processors with thousands of qubits for industrial applications.",
  "website": "https://www.planqc.eu",
  "featured": false,
  "headquarters": "Munich, Germany",
  "funding": "EUR 50M+"
}
```

- [ ] **Step 2: Create 2 benchmark entries**

`src/content/benchmarks/vqe-hydrogen.json`:
```json
{
  "name": "VQE Hydrogen Molecule Ground State",
  "slug": "vqe-hydrogen",
  "algorithm": "Variational Quantum Eigensolver (VQE)",
  "category": "chemistry",
  "tags": ["VQE", "chemistry", "ground-state", "hybrid"],
  "description": "Benchmark of the Variational Quantum Eigensolver algorithm for computing the ground state energy of the hydrogen molecule (H2). This is a standard benchmark for hybrid quantum-classical chemistry simulations, testing the interplay between quantum circuit evaluation and classical optimization.",
  "hardware": "Various (simulator and hardware)",
  "framework": "Qiskit, PennyLane",
  "qubits": 4,
  "reproducible": true,
  "datePublished": "2024-01-15"
}
```

`src/content/benchmarks/qaoa-maxcut.json`:
```json
{
  "name": "QAOA MaxCut Optimization",
  "slug": "qaoa-maxcut",
  "algorithm": "Quantum Approximate Optimization Algorithm (QAOA)",
  "category": "optimization",
  "tags": ["QAOA", "optimization", "MaxCut", "hybrid", "combinatorial"],
  "description": "Benchmark of the Quantum Approximate Optimization Algorithm for solving the MaxCut problem on random graphs. Tests the quality of approximate solutions as a function of circuit depth (p-levels) and graph size. A standard benchmark for hybrid quantum-classical optimization.",
  "framework": "PennyLane, Cirq",
  "qubits": 12,
  "reproducible": true,
  "datePublished": "2023-11-20"
}
```

- [ ] **Step 3: Create 2 use case entries**

`src/content/use-cases/drug-discovery-hybrid.json`:
```json
{
  "name": "Hybrid Quantum-Classical Drug Discovery",
  "slug": "drug-discovery-hybrid",
  "industry": "Pharmaceuticals",
  "category": "chemistry",
  "tags": ["drug-discovery", "molecular-simulation", "VQE", "hybrid"],
  "description": "Using hybrid quantum-classical methods to accelerate drug discovery by simulating molecular interactions more accurately than classical methods alone.",
  "problem": "Classical computers struggle to accurately simulate quantum mechanical properties of drug molecules, especially electron correlation effects in large molecular systems. This limits the accuracy of computational drug screening.",
  "approach": "Hybrid quantum-classical algorithms like VQE and quantum machine learning models are used to compute molecular properties. The quantum processor handles the quantum-mechanical simulation while classical computers manage optimization and data processing.",
  "results": "Early results show quantum-enhanced models can achieve chemical accuracy for small molecules. Scaling to pharmaceutically relevant molecules remains an active research challenge.",
  "companies": ["Pasqal", "IQM"],
  "source": "https://arxiv.org/abs/2301.00001"
}
```

`src/content/use-cases/portfolio-optimization.json`:
```json
{
  "name": "Quantum Portfolio Optimization",
  "slug": "portfolio-optimization",
  "industry": "Finance",
  "category": "finance",
  "tags": ["portfolio-optimization", "QAOA", "finance", "hybrid"],
  "description": "Applying quantum optimization algorithms to financial portfolio selection, aiming to find optimal asset allocations faster than classical solvers.",
  "problem": "Classical portfolio optimization becomes computationally intractable as the number of assets, constraints, and risk factors grows. The problem is NP-hard in its general form.",
  "approach": "QAOA and variational quantum algorithms encode portfolio constraints into quantum circuits. Hybrid loops optimize parameters classically while evaluating the objective function on quantum hardware.",
  "results": "Demonstrations on small portfolios (10-50 assets) show competitive results with classical methods. Quantum advantage for real-world portfolio sizes is expected as hardware scales."
}
```

- [ ] **Step 4: Create 1 challenge and 2 resource entries**

`src/content/challenges/qhack-2025.json`:
```json
{
  "name": "QHack 2025",
  "slug": "qhack-2025",
  "organizer": "Xanadu",
  "tags": ["hackathon", "PennyLane", "open-source", "annual"],
  "description": "QHack is the world's largest quantum computing hackathon, organized by Xanadu. Teams compete in coding challenges, build quantum projects, and attend workshops with industry leaders.",
  "website": "https://qhack.ai",
  "dateStart": "2025-02-01",
  "dateEnd": "2025-02-28",
  "status": "completed",
  "prizes": "Cash prizes, hardware access, internship opportunities",
  "location": "Online"
}
```

`src/content/resources/pennylane.json`:
```json
{
  "name": "PennyLane",
  "slug": "pennylane",
  "type": "framework",
  "tags": ["quantum-ml", "hybrid", "open-source", "python", "differentiable"],
  "description": "PennyLane is an open-source Python library for quantum machine learning, automatic differentiation, and hybrid quantum-classical computing. Developed by Xanadu, it supports multiple quantum hardware backends and integrates with PyTorch, TensorFlow, and JAX.",
  "website": "https://pennylane.ai",
  "openSource": true,
  "free": true,
  "language": "Python",
  "provider": "Xanadu"
}
```

`src/content/resources/qiskit.json`:
```json
{
  "name": "Qiskit",
  "slug": "qiskit",
  "type": "framework",
  "tags": ["quantum-computing", "open-source", "python", "IBM", "circuits"],
  "description": "Qiskit is an open-source SDK for quantum computing developed by IBM. It provides tools for creating and running quantum circuits on simulators and real IBM quantum hardware. Qiskit supports applications in chemistry, optimization, machine learning, and more.",
  "website": "https://qiskit.org",
  "openSource": true,
  "free": true,
  "language": "Python",
  "provider": "IBM"
}
```

- [ ] **Step 5: Verify build with real data**

```bash
npx astro build
```

Expected: Build succeeds. All JSON entries pass schema validation.

- [ ] **Step 6: Commit**

```bash
git add src/content/
git commit -m "feat: add sample data entries for development"
```

---

## Task 4: BaseLayout and SEO Helpers

**Files:**
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/components/JsonLd.astro`
- Create: `src/components/Header.astro`
- Create: `src/components/Footer.astro`

- [ ] **Step 1: Create JSON-LD helper component**

Create `src/components/JsonLd.astro`:

```astro
---
interface Props {
  data: Record<string, unknown>;
}
const { data } = Astro.props;
---
<script type="application/ld+json" set:html={JSON.stringify(data)} />
```

- [ ] **Step 2: Create Header component**

Create `src/components/Header.astro`:

```astro
---
const navItems = [
  { href: '/companies/', label: 'Companies' },
  { href: '/benchmarks/', label: 'Benchmarks' },
  { href: '/use-cases/', label: 'Use Cases' },
  { href: '/challenges/', label: 'Challenges' },
  { href: '/resources/', label: 'Resources' },
];
const currentPath = Astro.url.pathname;
---
<header class="border-b border-gray-200 bg-white">
  <nav class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
    <a href="/" class="text-xl font-bold text-indigo-700">Kvantiq Directory</a>
    <ul class="hidden gap-6 md:flex">
      {navItems.map(({ href, label }) => (
        <li>
          <a
            href={href}
            class={`text-sm font-medium ${currentPath.startsWith(href) ? 'text-indigo-700' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
    <a href="/submit/" class="rounded-md bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-800">
      Submit Listing
    </a>
  </nav>
</header>
```

- [ ] **Step 3: Create Footer component**

Create `src/components/Footer.astro`:

```astro
---
const year = new Date().getFullYear();
---
<footer class="border-t border-gray-200 bg-gray-50 mt-16">
  <div class="mx-auto max-w-7xl px-4 py-8">
    <div class="flex flex-col items-center justify-between gap-4 md:flex-row">
      <p class="text-sm text-gray-500">
        &copy; {year} Kvantiq Directory. European quantum computing ecosystem.
      </p>
      <nav class="flex gap-4 text-sm text-gray-500">
        <a href="/about/" class="hover:text-gray-700">About</a>
        <a href="/submit/" class="hover:text-gray-700">Submit</a>
        <a href="/newsletter/" class="hover:text-gray-700">Newsletter</a>
      </nav>
    </div>
  </div>
</footer>
```

- [ ] **Step 4: Create BaseLayout**

Create `src/layouts/BaseLayout.astro`:

```astro
---
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import JsonLd from '../components/JsonLd.astro';
import '../styles/global.css';

interface Props {
  title: string;
  description: string;
  ogImage?: string;
  jsonLd?: Record<string, unknown>;
  canonicalUrl?: string;
}

const { title, description, ogImage, jsonLd, canonicalUrl } = Astro.props;
const siteTitle = `${title} | Kvantiq Directory`;
const resolvedOgImage = ogImage || '/og-images/default.png';
const resolvedCanonical = canonicalUrl || Astro.url.href;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{siteTitle}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={resolvedCanonical} />

    <!-- Open Graph -->
    <meta property="og:title" content={siteTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={resolvedOgImage} />
    <meta property="og:url" content={resolvedCanonical} />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Kvantiq Directory" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={siteTitle} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={resolvedOgImage} />

    <!-- JSON-LD structured data -->
    {jsonLd && <JsonLd data={jsonLd} />}

    <!-- SpeakableSpecification for AI extraction -->
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": title,
      "description": description,
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": [".summary", ".faq"]
      }
    }} />
  </head>
  <body class="min-h-screen bg-white text-gray-900">
    <Header />
    <main class="mx-auto max-w-7xl px-4 py-8">
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 5: Update the default index page to use BaseLayout**

Replace `src/pages/index.astro` with:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="European Quantum Computing Directory" description="The curated directory of quantum computing companies, benchmarks, use cases, and resources across Europe.">
  <h1 class="text-3xl font-bold">Kvantiq Directory</h1>
  <p class="mt-2 text-gray-600">The European quantum computing ecosystem — coming soon.</p>
</BaseLayout>
```

- [ ] **Step 6: Verify build**

```bash
npx astro build
```

Expected: Build succeeds. Check `dist/index.html` contains semantic HTML with meta tags and JSON-LD.

- [ ] **Step 7: Commit**

```bash
git add src/layouts/ src/components/ src/pages/index.astro
git commit -m "feat: add BaseLayout with SEO meta, JSON-LD, header, and footer"
```

---

## Task 5: Shared UI Components

**Files:**
- Create: `src/components/ListingCard.astro`
- Create: `src/components/TagList.astro`
- Create: `src/components/NewsletterSignup.astro`

- [ ] **Step 1: Create TagList component**

Create `src/components/TagList.astro`:

```astro
---
interface Props {
  tags: string[];
}
const { tags } = Astro.props;
---
<ul class="flex flex-wrap gap-1.5">
  {tags.map((tag) => (
    <li class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
      {tag}
    </li>
  ))}
</ul>
```

- [ ] **Step 2: Create ListingCard component**

Create `src/components/ListingCard.astro`:

```astro
---
import TagList from './TagList.astro';

interface Props {
  title: string;
  href: string;
  description: string;
  tags: string[];
  meta?: string;
  featured?: boolean;
}
const { title, href, description, tags, meta, featured } = Astro.props;
---
<a href={href} class={`block rounded-lg border p-5 transition hover:shadow-md ${featured ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200'}`}>
  <div class="flex items-start justify-between gap-2">
    <h3 class="font-semibold text-gray-900">{title}</h3>
    {featured && <span class="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">Featured</span>}
  </div>
  {meta && <p class="mt-1 text-sm text-gray-500">{meta}</p>}
  <p class="mt-2 text-sm text-gray-600 line-clamp-2">{description}</p>
  <div class="mt-3">
    <TagList tags={tags} />
  </div>
</a>
```

- [ ] **Step 3: Create NewsletterSignup component**

Create `src/components/NewsletterSignup.astro`:

```astro
<aside class="rounded-lg border border-gray-200 bg-gray-50 p-6">
  <h3 class="font-semibold text-gray-900">Stay updated</h3>
  <p class="mt-1 text-sm text-gray-600">Get notified when we add new companies, benchmarks, and resources.</p>
  <form class="mt-3 flex gap-2" action="#" method="post">
    <input
      type="email"
      name="email"
      placeholder="you@example.com"
      required
      class="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
    />
    <button type="submit" class="rounded-md bg-indigo-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-800">
      Subscribe
    </button>
  </form>
  <p class="mt-2 text-xs text-gray-400">No tracking. No spam. Unsubscribe anytime.</p>
</aside>
```

- [ ] **Step 4: Verify build**

```bash
npx astro build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add ListingCard, TagList, and NewsletterSignup components"
```

---

## Task 6: Company Pages

**Files:**
- Create: `src/pages/companies/index.astro`
- Create: `src/pages/companies/[slug].astro`
- Create: `src/pages/companies/country/[country].astro`

This is the most complex page type — all other listing pages follow this pattern.

- [ ] **Step 1: Create company index page**

Create `src/pages/companies/index.astro`:

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import ListingCard from '../../components/ListingCard.astro';
import JsonLd from '../../components/JsonLd.astro';

const allCompanies = await getCollection('companies');
const sorted = allCompanies.sort((a, b) => {
  if (a.data.featured !== b.data.featured) return b.data.featured ? 1 : -1;
  return a.data.name.localeCompare(b.data.name);
});

const countries = [...new Set(allCompanies.map(c => c.data.country))].sort();

const itemListLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "European Quantum Computing Companies",
  "description": "Directory of quantum computing companies in Europe",
  "numberOfItems": allCompanies.length,
  "itemListElement": sorted.map((c, i) => ({
    "@type": "ListItem",
    "position": i + 1,
    "name": c.data.name,
    "url": `/companies/${c.data.slug}/`,
  })),
};
---
<BaseLayout
  title="Quantum Computing Companies in Europe"
  description={`Browse ${allCompanies.length} quantum computing companies across Europe. Filter by country, technology type, and specialization.`}
  jsonLd={itemListLd}
>
  <article>
    <h1 class="text-3xl font-bold">Quantum Computing Companies</h1>
    <div class="summary" role="doc-abstract">
      <p class="mt-2 text-gray-600">
        A curated directory of {allCompanies.length} quantum computing companies in Europe,
        covering hardware, software, cloud, and consulting across the Nordics and DACH regions.
      </p>
    </div>

    <!-- Country filter links -->
    <nav class="mt-6 flex flex-wrap gap-2">
      {countries.map(country => (
        <a href={`/companies/country/${country.toLowerCase()}/`} class="rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100">
          {country}
        </a>
      ))}
    </nav>

    <!-- Comparison table -->
    <div class="mt-8 overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="border-b text-left text-gray-500">
            <th class="pb-2 pr-4 font-medium">Company</th>
            <th class="pb-2 pr-4 font-medium">Country</th>
            <th class="pb-2 pr-4 font-medium">Type</th>
            <th class="pb-2 pr-4 font-medium">Founded</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(c => (
            <tr class="border-b border-gray-100">
              <td class="py-2 pr-4"><a href={`/companies/${c.data.slug}/`} class="text-indigo-700 hover:underline">{c.data.name}</a></td>
              <td class="py-2 pr-4 text-gray-600">{c.data.country}</td>
              <td class="py-2 pr-4 text-gray-600 capitalize">{c.data.type}</td>
              <td class="py-2 pr-4 text-gray-600">{c.data.founded || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <!-- Card grid -->
    <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map(c => (
        <ListingCard
          title={c.data.name}
          href={`/companies/${c.data.slug}/`}
          description={c.data.description}
          tags={c.data.tags}
          meta={`${c.data.country} · ${c.data.type}`}
          featured={c.data.featured}
        />
      ))}
    </div>
  </article>
</BaseLayout>
```

- [ ] **Step 2: Create individual company page**

Create `src/pages/companies/[slug].astro`:

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import TagList from '../../components/TagList.astro';
import JsonLd from '../../components/JsonLd.astro';

export async function getStaticPaths() {
  const companies = await getCollection('companies');
  return companies.map(c => ({
    params: { slug: c.data.slug },
    props: { company: c.data },
  }));
}

const { company } = Astro.props;

const orgLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": company.name,
  "url": company.website,
  "description": company.description,
  ...(company.founded && { "foundingDate": String(company.founded) }),
  ...(company.headquarters && {
    "address": {
      "@type": "PostalAddress",
      "addressLocality": company.headquarters,
    }
  }),
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": `What does ${company.name} do?`,
      "acceptedAnswer": { "@type": "Answer", "text": company.description },
    },
    {
      "@type": "Question",
      "name": `Where is ${company.name} based?`,
      "acceptedAnswer": { "@type": "Answer", "text": `${company.name} is based in ${company.headquarters || company.country}.` },
    },
  ],
};
---
<BaseLayout
  title={company.name}
  description={company.description}
  jsonLd={orgLd}
>
  <JsonLd data={faqLd} />

  <article>
    <h1 class="text-3xl font-bold">{company.name}</h1>

    <div class="summary mt-4" role="doc-abstract">
      <p class="text-gray-700">{company.description}</p>
      <ul class="mt-3 space-y-1 text-sm text-gray-600">
        {company.founded && <li>Founded: <time datetime={String(company.founded)}>{company.founded}</time></li>}
        <li>Country: {company.country}</li>
        <li>Type: <span class="capitalize">{company.type}</span></li>
        {company.headquarters && <li>Headquarters: {company.headquarters}</li>}
        {company.employees && <li>Employees: {company.employees}</li>}
        {company.funding && <li>Funding: {company.funding}</li>}
      </ul>
    </div>

    <div class="mt-4">
      <TagList tags={company.tags} />
    </div>

    <section class="mt-8">
      <h2 class="text-xl font-semibold">What does {company.name} do?</h2>
      <p class="mt-2 text-gray-700">{company.description}</p>
    </section>

    <section class="mt-6">
      <h2 class="text-xl font-semibold">Where is {company.name} based?</h2>
      <p class="mt-2 text-gray-700">{company.name} is headquartered in {company.headquarters || company.country}, in the {company.region === 'nordics' ? 'Nordic' : company.region === 'dach' ? 'DACH' : 'European'} quantum computing ecosystem.</p>
    </section>

    <section class="mt-6">
      <h2 class="text-xl font-semibold">Visit {company.name}</h2>
      <p class="mt-2">
        <a href={company.website} target="_blank" rel="noopener noreferrer" class="text-indigo-700 hover:underline">
          {company.website}
        </a>
      </p>
    </section>

    <section class="faq mt-8 rounded-lg border border-gray-200 p-6">
      <h2 class="text-lg font-semibold">Frequently Asked Questions</h2>
      <details class="mt-3">
        <summary class="cursor-pointer font-medium text-gray-700">What does {company.name} do?</summary>
        <p class="mt-2 text-sm text-gray-600">{company.description}</p>
      </details>
      <details class="mt-3">
        <summary class="cursor-pointer font-medium text-gray-700">Where is {company.name} based?</summary>
        <p class="mt-2 text-sm text-gray-600">{company.name} is based in {company.headquarters || company.country}.</p>
      </details>
      {company.founded && (
        <details class="mt-3">
          <summary class="cursor-pointer font-medium text-gray-700">When was {company.name} founded?</summary>
          <p class="mt-2 text-sm text-gray-600">{company.name} was founded in {company.founded}.</p>
        </details>
      )}
    </section>
  </article>
</BaseLayout>
```

- [ ] **Step 3: Create country filter page**

Create `src/pages/companies/country/[country].astro` (in a `country/` subdirectory to avoid routing conflict with `[slug].astro`):

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../../layouts/BaseLayout.astro';
import ListingCard from '../../../components/ListingCard.astro';

export async function getStaticPaths() {
  const companies = await getCollection('companies');
  const countries = [...new Set(companies.map(c => c.data.country))];
  return countries.map(country => ({
    params: { country: country.toLowerCase() },
    props: {
      countryName: country,
      companies: companies.filter(c => c.data.country === country),
    },
  }));
}

const { countryName, companies } = Astro.props;
const sorted = companies.sort((a, b) => a.data.name.localeCompare(b.data.name));
---
<BaseLayout
  title={`Quantum Computing Companies in ${countryName}`}
  description={`Browse ${companies.length} quantum computing companies based in ${countryName}.`}
>
  <article>
    <h1 class="text-3xl font-bold">Quantum Companies in {countryName}</h1>
    <div class="summary" role="doc-abstract">
      <p class="mt-2 text-gray-600">
        {companies.length} quantum computing {companies.length === 1 ? 'company' : 'companies'} based in {countryName}.
      </p>
    </div>

    <div class="mt-2">
      <a href="/companies/" class="text-sm text-indigo-700 hover:underline">&larr; All companies</a>
    </div>

    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map(c => (
        <ListingCard
          title={c.data.name}
          href={`/companies/${c.data.slug}/`}
          description={c.data.description}
          tags={c.data.tags}
          meta={c.data.type}
          featured={c.data.featured}
        />
      ))}
    </div>
  </article>
</BaseLayout>
```

- [ ] **Step 4: Verify build and check output**

```bash
npx astro build
```

Expected: Build succeeds. Check that these files exist in `dist/`:
- `dist/companies/index.html`
- `dist/companies/iqm/index.html`
- `dist/companies/pasqal/index.html`
- `dist/companies/planqc/index.html`
- `dist/companies/country/finland/index.html`
- `dist/companies/country/france/index.html`
- `dist/companies/country/germany/index.html`

- [ ] **Step 5: Commit**

```bash
git add src/pages/companies/
git commit -m "feat: add company pages — index, individual, and country filter"
```

---

## Task 7: Benchmark, Use Case, Challenge, and Resource Pages

**Files:**
- Create: `src/pages/benchmarks/index.astro`
- Create: `src/pages/benchmarks/[slug].astro`
- Create: `src/pages/use-cases/index.astro`
- Create: `src/pages/use-cases/[slug].astro`
- Create: `src/pages/challenges/index.astro`
- Create: `src/pages/challenges/[slug].astro`
- Create: `src/pages/resources/index.astro`

These all follow the same pattern as company pages. Each page type gets:
- Index page with comparison table + card grid + ItemList JSON-LD
- Individual pages with type-specific JSON-LD schema + FAQ section + summary block
- (Resources only have an index page — individual resources link out to external sites)

- [ ] **Step 1: Create benchmark index page**

Create `src/pages/benchmarks/index.astro`:

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import ListingCard from '../../components/ListingCard.astro';

const allBenchmarks = await getCollection('benchmarks');
const sorted = allBenchmarks.sort((a, b) => a.data.name.localeCompare(b.data.name));

const itemListLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Quantum Computing Benchmarks",
  "numberOfItems": allBenchmarks.length,
  "itemListElement": sorted.map((b, i) => ({
    "@type": "ListItem",
    "position": i + 1,
    "name": b.data.name,
    "url": `/benchmarks/${b.data.slug}/`,
  })),
};
---
<BaseLayout
  title="Quantum Computing Benchmarks"
  description={`Browse ${allBenchmarks.length} reproducible quantum computing benchmarks across optimization, chemistry, machine learning, and more.`}
  jsonLd={itemListLd}
>
  <article>
    <h1 class="text-3xl font-bold">Quantum Computing Benchmarks</h1>
    <div class="summary" role="doc-abstract">
      <p class="mt-2 text-gray-600">
        {allBenchmarks.length} reproducible quantum computing benchmarks for hybrid quantum-classical algorithms.
      </p>
    </div>

    <div class="mt-8 overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="border-b text-left text-gray-500">
            <th class="pb-2 pr-4 font-medium">Benchmark</th>
            <th class="pb-2 pr-4 font-medium">Algorithm</th>
            <th class="pb-2 pr-4 font-medium">Category</th>
            <th class="pb-2 pr-4 font-medium">Qubits</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(b => (
            <tr class="border-b border-gray-100">
              <td class="py-2 pr-4"><a href={`/benchmarks/${b.data.slug}/`} class="text-indigo-700 hover:underline">{b.data.name}</a></td>
              <td class="py-2 pr-4 text-gray-600">{b.data.algorithm}</td>
              <td class="py-2 pr-4 text-gray-600 capitalize">{b.data.category}</td>
              <td class="py-2 pr-4 text-gray-600">{b.data.qubits || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map(b => (
        <ListingCard
          title={b.data.name}
          href={`/benchmarks/${b.data.slug}/`}
          description={b.data.description}
          tags={b.data.tags}
          meta={`${b.data.algorithm} · ${b.data.category}`}
        />
      ))}
    </div>
  </article>
</BaseLayout>
```

- [ ] **Step 2: Create individual benchmark page**

Create `src/pages/benchmarks/[slug].astro`:

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import TagList from '../../components/TagList.astro';
import JsonLd from '../../components/JsonLd.astro';

export async function getStaticPaths() {
  const benchmarks = await getCollection('benchmarks');
  return benchmarks.map(b => ({
    params: { slug: b.data.slug },
    props: { benchmark: b.data },
  }));
}

const { benchmark } = Astro.props;

const datasetLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  "name": benchmark.name,
  "description": benchmark.description,
  ...(benchmark.datePublished && { "datePublished": benchmark.datePublished }),
  ...(benchmark.source && { "url": benchmark.source }),
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": `What is the ${benchmark.name} benchmark?`, "acceptedAnswer": { "@type": "Answer", "text": benchmark.description } },
    { "@type": "Question", "name": `What algorithm does ${benchmark.name} use?`, "acceptedAnswer": { "@type": "Answer", "text": `${benchmark.name} uses the ${benchmark.algorithm} algorithm.` } },
    { "@type": "Question", "name": `Is the ${benchmark.name} benchmark reproducible?`, "acceptedAnswer": { "@type": "Answer", "text": benchmark.reproducible ? `Yes, ${benchmark.name} is reproducible.` : `Reproducibility has not been confirmed.` } },
  ],
};
---
<BaseLayout title={benchmark.name} description={benchmark.description} jsonLd={datasetLd}>
  <JsonLd data={faqLd} />
  <article>
    <h1 class="text-3xl font-bold">{benchmark.name}</h1>
    <div class="summary mt-4" role="doc-abstract">
      <p class="text-gray-700">{benchmark.description}</p>
      <ul class="mt-3 space-y-1 text-sm text-gray-600">
        <li>Algorithm: {benchmark.algorithm}</li>
        <li>Category: <span class="capitalize">{benchmark.category}</span></li>
        {benchmark.qubits && <li>Qubits: {benchmark.qubits}</li>}
        {benchmark.framework && <li>Framework: {benchmark.framework}</li>}
        {benchmark.hardware && <li>Hardware: {benchmark.hardware}</li>}
        <li>Reproducible: {benchmark.reproducible ? 'Yes' : 'Not confirmed'}</li>
        {benchmark.datePublished && <li>Published: <time datetime={benchmark.datePublished}>{benchmark.datePublished}</time></li>}
      </ul>
    </div>
    <div class="mt-4"><TagList tags={benchmark.tags} /></div>

    <section class="mt-8">
      <h2 class="text-xl font-semibold">What algorithm does {benchmark.name} use?</h2>
      <p class="mt-2 text-gray-700">{benchmark.name} uses the {benchmark.algorithm} algorithm, categorized under {benchmark.category}.</p>
    </section>

    {benchmark.source && (
      <section class="mt-6">
        <h2 class="text-xl font-semibold">Where can I find this benchmark?</h2>
        <p class="mt-2"><a href={benchmark.source} target="_blank" rel="noopener noreferrer" class="text-indigo-700 hover:underline">{benchmark.source}</a></p>
      </section>
    )}

    <section class="faq mt-8 rounded-lg border border-gray-200 p-6">
      <h2 class="text-lg font-semibold">Frequently Asked Questions</h2>
      <details class="mt-3">
        <summary class="cursor-pointer font-medium text-gray-700">What is the {benchmark.name} benchmark?</summary>
        <p class="mt-2 text-sm text-gray-600">{benchmark.description}</p>
      </details>
      <details class="mt-3">
        <summary class="cursor-pointer font-medium text-gray-700">Is {benchmark.name} reproducible?</summary>
        <p class="mt-2 text-sm text-gray-600">{benchmark.reproducible ? `Yes, this benchmark is reproducible.` : `Reproducibility has not been confirmed for this benchmark.`}</p>
      </details>
    </section>
  </article>
</BaseLayout>
```

- [ ] **Step 3: Create use case index page**

Create `src/pages/use-cases/index.astro`:

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import ListingCard from '../../components/ListingCard.astro';

const allUseCases = await getCollection('use-cases');
const sorted = allUseCases.sort((a, b) => a.data.name.localeCompare(b.data.name));

const itemListLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Quantum Computing Use Cases",
  "numberOfItems": allUseCases.length,
  "itemListElement": sorted.map((u, i) => ({
    "@type": "ListItem", "position": i + 1, "name": u.data.name, "url": `/use-cases/${u.data.slug}/`,
  })),
};
---
<BaseLayout
  title="Quantum Computing Use Cases"
  description={`Browse ${allUseCases.length} real-world hybrid quantum-classical use cases across industries.`}
  jsonLd={itemListLd}
>
  <article>
    <h1 class="text-3xl font-bold">Quantum Computing Use Cases</h1>
    <div class="summary" role="doc-abstract">
      <p class="mt-2 text-gray-600">{allUseCases.length} real-world use cases for hybrid quantum-classical computing.</p>
    </div>

    <div class="mt-8 overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead><tr class="border-b text-left text-gray-500">
          <th class="pb-2 pr-4 font-medium">Use Case</th>
          <th class="pb-2 pr-4 font-medium">Industry</th>
          <th class="pb-2 pr-4 font-medium">Category</th>
        </tr></thead>
        <tbody>
          {sorted.map(u => (
            <tr class="border-b border-gray-100">
              <td class="py-2 pr-4"><a href={`/use-cases/${u.data.slug}/`} class="text-indigo-700 hover:underline">{u.data.name}</a></td>
              <td class="py-2 pr-4 text-gray-600">{u.data.industry}</td>
              <td class="py-2 pr-4 text-gray-600 capitalize">{u.data.category}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map(u => (
        <ListingCard title={u.data.name} href={`/use-cases/${u.data.slug}/`} description={u.data.description} tags={u.data.tags} meta={`${u.data.industry} · ${u.data.category}`} />
      ))}
    </div>
  </article>
</BaseLayout>
```

- [ ] **Step 4: Create individual use case page**

Create `src/pages/use-cases/[slug].astro`:

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import TagList from '../../components/TagList.astro';
import JsonLd from '../../components/JsonLd.astro';

export async function getStaticPaths() {
  const useCases = await getCollection('use-cases');
  return useCases.map(u => ({ params: { slug: u.data.slug }, props: { useCase: u.data } }));
}

const { useCase } = Astro.props;

const articleLd = {
  "@context": "https://schema.org", "@type": "Article",
  "headline": useCase.name, "description": useCase.description,
  "about": { "@type": "Thing", "name": useCase.industry },
};

const faqLd = {
  "@context": "https://schema.org", "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": `What problem does ${useCase.name} solve?`, "acceptedAnswer": { "@type": "Answer", "text": useCase.problem } },
    { "@type": "Question", "name": `How does quantum computing help with ${useCase.name.toLowerCase()}?`, "acceptedAnswer": { "@type": "Answer", "text": useCase.approach } },
  ],
};
---
<BaseLayout title={useCase.name} description={useCase.description} jsonLd={articleLd}>
  <JsonLd data={faqLd} />
  <article>
    <h1 class="text-3xl font-bold">{useCase.name}</h1>
    <div class="summary mt-4" role="doc-abstract">
      <p class="text-gray-700">{useCase.description}</p>
      <ul class="mt-3 space-y-1 text-sm text-gray-600">
        <li>Industry: {useCase.industry}</li>
        <li>Category: <span class="capitalize">{useCase.category}</span></li>
      </ul>
    </div>
    <div class="mt-4"><TagList tags={useCase.tags} /></div>

    <section class="mt-8">
      <h2 class="text-xl font-semibold">What is the problem?</h2>
      <p class="mt-2 text-gray-700">{useCase.problem}</p>
    </section>

    <section class="mt-6">
      <h2 class="text-xl font-semibold">How does quantum computing help?</h2>
      <p class="mt-2 text-gray-700">{useCase.approach}</p>
    </section>

    {useCase.results && (
      <section class="mt-6">
        <h2 class="text-xl font-semibold">What are the results?</h2>
        <p class="mt-2 text-gray-700">{useCase.results}</p>
      </section>
    )}

    {useCase.source && (
      <section class="mt-6">
        <h2 class="text-xl font-semibold">Source</h2>
        <p class="mt-2"><a href={useCase.source} target="_blank" rel="noopener noreferrer" class="text-indigo-700 hover:underline">{useCase.source}</a></p>
      </section>
    )}

    <section class="faq mt-8 rounded-lg border border-gray-200 p-6">
      <h2 class="text-lg font-semibold">Frequently Asked Questions</h2>
      <details class="mt-3">
        <summary class="cursor-pointer font-medium text-gray-700">What problem does {useCase.name} solve?</summary>
        <p class="mt-2 text-sm text-gray-600">{useCase.problem}</p>
      </details>
      <details class="mt-3">
        <summary class="cursor-pointer font-medium text-gray-700">How does quantum computing help?</summary>
        <p class="mt-2 text-sm text-gray-600">{useCase.approach}</p>
      </details>
    </section>
  </article>
</BaseLayout>
```

- [ ] **Step 5: Create challenge index page**

Create `src/pages/challenges/index.astro`:

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import ListingCard from '../../components/ListingCard.astro';

const allChallenges = await getCollection('challenges');
const sorted = allChallenges.sort((a, b) => a.data.name.localeCompare(b.data.name));

const itemListLd = {
  "@context": "https://schema.org", "@type": "ItemList",
  "name": "Quantum Computing Challenges & Competitions",
  "numberOfItems": allChallenges.length,
  "itemListElement": sorted.map((ch, i) => ({
    "@type": "ListItem", "position": i + 1, "name": ch.data.name, "url": `/challenges/${ch.data.slug}/`,
  })),
};
---
<BaseLayout
  title="Quantum Computing Challenges"
  description={`Browse ${allChallenges.length} quantum computing hackathons, competitions, and challenges.`}
  jsonLd={itemListLd}
>
  <article>
    <h1 class="text-3xl font-bold">Quantum Computing Challenges</h1>
    <div class="summary" role="doc-abstract">
      <p class="mt-2 text-gray-600">{allChallenges.length} quantum computing hackathons, competitions, and open challenges.</p>
    </div>

    <div class="mt-8 overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead><tr class="border-b text-left text-gray-500">
          <th class="pb-2 pr-4 font-medium">Challenge</th>
          <th class="pb-2 pr-4 font-medium">Organizer</th>
          <th class="pb-2 pr-4 font-medium">Status</th>
          <th class="pb-2 pr-4 font-medium">Date</th>
        </tr></thead>
        <tbody>
          {sorted.map(ch => (
            <tr class="border-b border-gray-100">
              <td class="py-2 pr-4"><a href={`/challenges/${ch.data.slug}/`} class="text-indigo-700 hover:underline">{ch.data.name}</a></td>
              <td class="py-2 pr-4 text-gray-600">{ch.data.organizer}</td>
              <td class="py-2 pr-4 text-gray-600 capitalize">{ch.data.status}</td>
              <td class="py-2 pr-4 text-gray-600">{ch.data.dateStart || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map(ch => (
        <ListingCard title={ch.data.name} href={`/challenges/${ch.data.slug}/`} description={ch.data.description} tags={ch.data.tags} meta={`${ch.data.organizer} · ${ch.data.status}`} />
      ))}
    </div>
  </article>
</BaseLayout>
```

- [ ] **Step 6: Create individual challenge page**

Create `src/pages/challenges/[slug].astro`:

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import TagList from '../../components/TagList.astro';
import JsonLd from '../../components/JsonLd.astro';

export async function getStaticPaths() {
  const challenges = await getCollection('challenges');
  return challenges.map(ch => ({ params: { slug: ch.data.slug }, props: { challenge: ch.data } }));
}

const { challenge } = Astro.props;

const eventLd = {
  "@context": "https://schema.org", "@type": "Event",
  "name": challenge.name, "description": challenge.description,
  "url": challenge.website,
  "organizer": { "@type": "Organization", "name": challenge.organizer },
  ...(challenge.dateStart && { "startDate": challenge.dateStart }),
  ...(challenge.dateEnd && { "endDate": challenge.dateEnd }),
  ...(challenge.location && { "location": { "@type": "Place", "name": challenge.location } }),
};
---
<BaseLayout title={challenge.name} description={challenge.description} jsonLd={eventLd}>
  <article>
    <h1 class="text-3xl font-bold">{challenge.name}</h1>
    <div class="summary mt-4" role="doc-abstract">
      <p class="text-gray-700">{challenge.description}</p>
      <ul class="mt-3 space-y-1 text-sm text-gray-600">
        <li>Organizer: {challenge.organizer}</li>
        <li>Status: <span class="capitalize">{challenge.status}</span></li>
        {challenge.dateStart && <li>Start: <time datetime={challenge.dateStart}>{challenge.dateStart}</time></li>}
        {challenge.dateEnd && <li>End: <time datetime={challenge.dateEnd}>{challenge.dateEnd}</time></li>}
        {challenge.location && <li>Location: {challenge.location}</li>}
        {challenge.prizes && <li>Prizes: {challenge.prizes}</li>}
      </ul>
    </div>
    <div class="mt-4"><TagList tags={challenge.tags} /></div>

    <section class="mt-8">
      <h2 class="text-xl font-semibold">Visit {challenge.name}</h2>
      <p class="mt-2"><a href={challenge.website} target="_blank" rel="noopener noreferrer" class="text-indigo-700 hover:underline">{challenge.website}</a></p>
    </section>

    <section class="faq mt-8 rounded-lg border border-gray-200 p-6">
      <h2 class="text-lg font-semibold">Frequently Asked Questions</h2>
      <details class="mt-3">
        <summary class="cursor-pointer font-medium text-gray-700">What is {challenge.name}?</summary>
        <p class="mt-2 text-sm text-gray-600">{challenge.description}</p>
      </details>
      <details class="mt-3">
        <summary class="cursor-pointer font-medium text-gray-700">Who organizes {challenge.name}?</summary>
        <p class="mt-2 text-sm text-gray-600">{challenge.name} is organized by {challenge.organizer}.</p>
      </details>
    </section>
  </article>
</BaseLayout>
```

- [ ] **Step 7: Create resources index page**

Create `src/pages/resources/index.astro`. No individual pages — each resource links to its external website.

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import TagList from '../../components/TagList.astro';

const allResources = await getCollection('resources');
const sorted = allResources.sort((a, b) => a.data.name.localeCompare(b.data.name));

const itemListLd = {
  "@context": "https://schema.org", "@type": "ItemList",
  "name": "Quantum Computing Resources",
  "numberOfItems": allResources.length,
  "itemListElement": sorted.map((r, i) => ({
    "@type": "ListItem", "position": i + 1,
    "item": { "@type": "LearningResource", "name": r.data.name, "url": r.data.website, "description": r.data.description },
  })),
};
---
<BaseLayout
  title="Quantum Computing Resources"
  description={`Browse ${allResources.length} quantum computing frameworks, courses, funding programs, and tools.`}
  jsonLd={itemListLd}
>
  <article>
    <h1 class="text-3xl font-bold">Quantum Computing Resources</h1>
    <div class="summary" role="doc-abstract">
      <p class="mt-2 text-gray-600">{allResources.length} frameworks, courses, funding programs, and tools for quantum computing.</p>
    </div>

    <div class="mt-8 overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead><tr class="border-b text-left text-gray-500">
          <th class="pb-2 pr-4 font-medium">Resource</th>
          <th class="pb-2 pr-4 font-medium">Type</th>
          <th class="pb-2 pr-4 font-medium">Provider</th>
          <th class="pb-2 pr-4 font-medium">Open Source</th>
        </tr></thead>
        <tbody>
          {sorted.map(r => (
            <tr class="border-b border-gray-100">
              <td class="py-2 pr-4"><a href={r.data.website} target="_blank" rel="noopener noreferrer" class="text-indigo-700 hover:underline">{r.data.name}</a></td>
              <td class="py-2 pr-4 text-gray-600 capitalize">{r.data.type}</td>
              <td class="py-2 pr-4 text-gray-600">{r.data.provider || '—'}</td>
              <td class="py-2 pr-4 text-gray-600">{r.data.openSource ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map(r => (
        <a href={r.data.website} target="_blank" rel="noopener noreferrer" class="block rounded-lg border border-gray-200 p-5 transition hover:shadow-md">
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold text-gray-900">{r.data.name}</h3>
            {r.data.openSource && <span class="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Open Source</span>}
          </div>
          <p class="mt-1 text-sm text-gray-500 capitalize">{r.data.type}{r.data.provider ? ` · ${r.data.provider}` : ''}</p>
          <p class="mt-2 text-sm text-gray-600 line-clamp-2">{r.data.description}</p>
          <div class="mt-3"><TagList tags={r.data.tags} /></div>
        </a>
      ))}
    </div>
  </article>
</BaseLayout>
```

- [ ] **Step 8: Verify build**

```bash
npx astro build
```

Expected: All pages build. Check `dist/` for benchmarks/, use-cases/, challenges/, resources/ directories.

- [ ] **Step 9: Commit**

```bash
git add src/pages/benchmarks/ src/pages/use-cases/ src/pages/challenges/ src/pages/resources/
git commit -m "feat: add benchmark, use case, challenge, and resource pages"
```

---

## Task 8: Static Pages and Homepage

**Files:**
- Modify: `src/pages/index.astro`
- Create: `src/pages/about.astro`
- Create: `src/pages/submit.astro`
- Create: `src/pages/newsletter.astro`

- [ ] **Step 1: Build the homepage**

Replace `src/pages/index.astro` with a full homepage:
- Hero section with site title, tagline, and search bar placeholder
- Featured listings section (companies where `featured: true`)
- Category cards linking to /companies/, /benchmarks/, etc.
- Newsletter signup at bottom
- JSON-LD `WebSite` schema with `SearchAction`

Use `getCollection('companies')` filtered to `featured === true` for the featured section.

- [ ] **Step 2: Create about page**

`src/pages/about.astro`: Static content explaining Kvantiq Directory, the ethics policy, who's behind it (Kvantiq/DQC community), geographic scope, and how to submit listings.

- [ ] **Step 3: Create submit page**

`src/pages/submit.astro`: Embed a Tally.so form (or placeholder with instructions to create one). Include explanation of what types of listings are accepted and the ethics policy.

- [ ] **Step 4: Create newsletter page**

`src/pages/newsletter.astro`: Newsletter signup form (same component as the footer one, but full-page with more context about what subscribers receive).

- [ ] **Step 5: Verify build**

```bash
npx astro build
```

Expected: All static pages build. Homepage shows featured companies.

- [ ] **Step 6: Commit**

```bash
git add src/pages/
git commit -m "feat: add homepage, about, submit, and newsletter pages"
```

---

## Task 9: AI Optimization Files

**Files:**
- Create: `public/robots.txt`
- Create: `public/llms.txt`
- Create: `src/pages/llms-full.txt.ts` (generated at build time)

- [ ] **Step 1: Create robots.txt**

Create `public/robots.txt` with the full AI crawler allowlist from the spec (all 18+ user agents explicitly allowed, plus sitemap reference).

- [ ] **Step 2: Create llms.txt**

Create `public/llms.txt` with the spec-compliant format from the design doc.

- [ ] **Step 3: Create llms-full.txt endpoint**

Create `src/pages/llms-full.txt.ts` — an Astro endpoint that generates the full content at build time by concatenating all collection entries:

```typescript
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const companies = await getCollection('companies');
  const benchmarks = await getCollection('benchmarks');
  const useCases = await getCollection('use-cases');
  const challenges = await getCollection('challenges');
  const resources = await getCollection('resources');

  let content = '# Kvantiq Directory — Full Content\n\n';
  content += '> The European directory for quantum computing.\n\n';

  content += '## Companies\n\n';
  for (const c of companies) {
    content += `### ${c.data.name}\n`;
    content += `${c.data.description}\n`;
    content += `- Country: ${c.data.country}\n`;
    content += `- Type: ${c.data.type}\n`;
    content += `- Website: ${c.data.website}\n`;
    if (c.data.founded) content += `- Founded: ${c.data.founded}\n`;
    content += `- Tags: ${c.data.tags.join(', ')}\n\n`;
  }

  content += '## Benchmarks\n\n';
  for (const b of benchmarks) {
    content += `### ${b.data.name}\n`;
    content += `${b.data.description}\n`;
    content += `- Algorithm: ${b.data.algorithm}\n`;
    content += `- Category: ${b.data.category}\n`;
    if (b.data.qubits) content += `- Qubits: ${b.data.qubits}\n`;
    content += `- Reproducible: ${b.data.reproducible ? 'Yes' : 'No'}\n\n`;
  }

  content += '## Use Cases\n\n';
  for (const u of useCases) {
    content += `### ${u.data.name}\n`;
    content += `${u.data.description}\n`;
    content += `- Industry: ${u.data.industry}\n`;
    content += `- Problem: ${u.data.problem}\n`;
    content += `- Approach: ${u.data.approach}\n\n`;
  }

  content += '## Challenges\n\n';
  for (const ch of challenges) {
    content += `### ${ch.data.name}\n`;
    content += `${ch.data.description}\n`;
    content += `- Organizer: ${ch.data.organizer}\n`;
    content += `- Website: ${ch.data.website}\n\n`;
  }

  content += '## Resources\n\n';
  for (const r of resources) {
    content += `### ${r.data.name}\n`;
    content += `${r.data.description}\n`;
    content += `- Type: ${r.data.type}\n`;
    content += `- Website: ${r.data.website}\n`;
    content += `- Open Source: ${r.data.openSource ? 'Yes' : 'No'}\n\n`;
  }

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
```

- [ ] **Step 4: Verify build**

```bash
npx astro build
```

Expected: `dist/robots.txt`, `dist/llms.txt`, and `dist/llms-full.txt` all exist with correct content.

- [ ] **Step 5: Commit**

```bash
git add public/robots.txt public/llms.txt src/pages/llms-full.txt.ts
git commit -m "feat: add robots.txt, llms.txt, and llms-full.txt for AI discoverability"
```

---

## Task 10: Pagefind Search Integration

**Files:**
- Create: `src/components/SearchBar.astro`
- Modify: `src/layouts/BaseLayout.astro` (add Pagefind CSS/JS)
- Modify: `package.json` (add postbuild script)

- [ ] **Step 1: Install Pagefind**

```bash
npm install -D pagefind
```

- [ ] **Step 2: Add postbuild script to package.json**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "postbuild": "pagefind --site dist"
  }
}
```

- [ ] **Step 3: Create SearchBar component**

Create `src/components/SearchBar.astro`:

```astro
<div id="search" class="w-full max-w-md"></div>
<link href="/pagefind/pagefind-ui.css" rel="stylesheet" />
<script is:inline src="/pagefind/pagefind-ui.js"></script>
<script is:inline>
  window.addEventListener('DOMContentLoaded', () => {
    new PagefindUI({ element: '#search', showSubResults: true });
  });
</script>
```

- [ ] **Step 4: Add SearchBar to Header component**

Add the SearchBar import and render it in the Header nav area.

- [ ] **Step 5: Add Pagefind data attributes to listing content**

In `BaseLayout.astro`, add `data-pagefind-body` to `<main>`. In `Header.astro` and `Footer.astro`, add `data-pagefind-ignore`.

- [ ] **Step 6: Verify build with Pagefind**

```bash
npx astro build
```

Expected: Build succeeds. Pagefind runs as postbuild step and creates `dist/pagefind/` directory with index files.

- [ ] **Step 7: Test locally**

```bash
npx astro preview
```

Open in browser. Search for "IQM" — should find the company page.

- [ ] **Step 8: Commit**

```bash
git add package.json src/components/SearchBar.astro src/layouts/BaseLayout.astro src/components/Header.astro src/components/Footer.astro
git commit -m "feat: add Pagefind search integration"
```

---

## Task 11: Final Build Verification

- [ ] **Step 1: Full clean build**

```bash
rm -rf dist node_modules/.astro
npx astro build
```

Expected: Clean build succeeds with zero errors.

- [ ] **Step 2: Verify page count**

Check that `dist/` contains all expected pages:
- `/index.html` (homepage)
- `/about/index.html`
- `/submit/index.html`
- `/newsletter/index.html`
- `/companies/index.html` + individual + country pages
- `/benchmarks/index.html` + individual pages
- `/use-cases/index.html` + individual pages
- `/challenges/index.html` + individual pages
- `/resources/index.html`
- `/robots.txt`
- `/llms.txt`
- `/llms-full.txt`
- `/sitemap-index.xml` (or `/sitemap-0.xml`)
- `/pagefind/` directory

- [ ] **Step 3: Spot-check HTML quality**

Open `dist/companies/iqm/index.html` and verify:
- Semantic HTML5 (`<main>`, `<article>`, `<section>`)
- JSON-LD `Organization` schema in `<head>`
- JSON-LD `FAQPage` schema
- `SpeakableSpecification` schema
- `role="doc-abstract"` on summary block
- `<time datetime="">` elements
- Open Graph meta tags
- Canonical URL

- [ ] **Step 4: Preview locally**

```bash
npx astro preview
```

Manually check:
- Homepage loads, featured companies show
- Navigation works
- Company → individual page works
- Country filter works
- Search returns results
- All category index pages load
- About/submit/newsletter pages load
- Mobile responsive (resize browser)

- [ ] **Step 5: Commit final state**

```bash
git add -A
git commit -m "chore: final build verification — all pages rendering correctly"
```

---

## What Comes Next (Not Part of This Plan)

After this plan is complete, the site template is working with sample data. The next steps are:

1. **Content Population** — Generate 200+ real listings with Claude (separate task)
2. **GitHub + Vercel Deployment** — Push to GitHub, connect Vercel (manual steps per launch checklist)
3. **Discoverability** — Submit sitemaps, post on Reddit/HN (manual steps per launch checklist)
