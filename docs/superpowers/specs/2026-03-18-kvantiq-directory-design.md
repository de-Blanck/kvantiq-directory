# Kvantiq Directory — Design Specification

## 1. Project Overview

### What
A passive income online directory for the European quantum computing ecosystem. Covers companies, benchmarks, use cases, challenges, and resources — focused on hybrid quantum-classical and quantum-AI.

### Why
- EUR 10+ billion in combined EU + national quantum funding
- Zero Europe-focused quantum directories exist
- The Quantum Insider (biggest competitor) is US-centric and paywalled
- 150+ European quantum companies with no single place to find/compare them

### Who
- **Primary audience A:** Enterprise decision makers (CTOs, innovation leads evaluating quantum) — highest monetization value
- **Primary audience B:** Students and career changers — highest traffic volume
- Both audiences served through the same structured data pages, different entry points

### Scope
- **Geographic:** Nordics + DACH first (Denmark, Finland, Sweden, Germany, Austria, Netherlands), then expand to all of Europe
- **Language:** English only
- **Content involvement:** Minimal / as passive as possible
- **Budget:** $0/month ($10/year domain max)

### Ethics Policy
1. **European-first, open-source preferred.** Affiliate links and featured listings prioritize European companies and open-source projects. No driving traffic to closed-source surveillance capitalism platforms.
2. **No visitor data exploitation.** No third-party tracking pixels, no Google Analytics, no Facebook pixels. Analytics via privacy-respecting tools only (Plausible CE, Umami, or Vercel Analytics — all GDPR-compliant by design).
3. **Ad network choice matters.** No Google AdSense. Instead: EthicalAds (open-source focused, no tracking) or Carbon Ads (developer-focused, minimal tracking). Both serve contextual ads without profiling visitors.
4. **Allowlist, not blocklist.** Companies/resources get listed based on alignment with open science, European tech sovereignty, and democratic values.

#### Affiliate/Link Allowlist
| Link to | Reason |
|---|---|
| European quantum companies (IQM, Pasqal, AQT, etc.) | European, building the ecosystem |
| Open-source frameworks (PennyLane, Qiskit, Cirq) | Open source, community-driven |
| EuroHPC / EU funding programs | Public good, pro-research |
| Privacy-respecting course platforms | Education, no surveillance |
| IBM Quantum | Open-source Qiskit, open access tier, research-friendly |
| NVIDIA CUDA-Q | Only the open-source tooling, not proprietary cloud lock-in |

#### Affiliate/Link Blocklist
| Don't link to | Reason |
|---|---|
| AWS Braket affiliate program | Amazon's surveillance capitalism model |
| Google/Alphabet quantum products | Tracking-driven business model |
| Meta/any social media platform referrals | Surveillance capitalism |
| Any "free tier" that harvests user data as the real product | Against the ethics policy |

---

## 2. Architecture

### Tech Stack
| Layer | Tool | Cost |
|---|---|---|
| Framework | Astro (static site generator) | Free |
| Data | JSON files in `data/` directory | Free |
| Styling | Tailwind CSS | Free |
| Search | Pagefind (client-side, built at build time) | Free |
| Hosting | Vercel free tier | $0 |
| Domain | kvantiq.com or subdomain | ~$10/year |
| Sitemap | @astrojs/sitemap | Free |
| Forms | Tally.so (GDPR-compliant, EU-hosted) | Free |
| Newsletter | Buttondown (free up to 100 subscribers) | $0 |
| Analytics | Plausible CE or Vercel Analytics | $0 |
| Ads (future) | EthicalAds or Carbon Ads | $0 (earns money) |

**Total running cost:** $0/month ($10/year for domain only).

### Why Static Site
- $0 hosting (Vercel free tier handles ~100K visits/month)
- Blazing fast (static HTML = Google and AI crawlers love it)
- Dead simple to update via AI — edit JSON files and push
- Full ownership, no vendor lock-in
- Perfect for programmatic SEO (hundreds of pages from structured data)
- Clean HTML output ideal for AI crawler extraction

### Data Model

All directory data lives in structured JSON files in the repo:

```
data/
  companies/
    iqm.json
    pasqal.json
    ...
  benchmarks/
    vqe-hydrogen.json
    qaoa-maxcut.json
    ...
  use-cases/
    drug-discovery-hybrid.json
    portfolio-optimization.json
    ...
  challenges/
    qhack-2025.json
    ibm-challenge-2025.json
    ...
  resources/
    courses/
    frameworks/
    funding-programs/
```

#### Company Schema
```json
{
  "name": "IQM Quantum Computers",
  "slug": "iqm",
  "country": "Finland",
  "region": "nordics",
  "type": "hardware",
  "tags": ["superconducting", "hybrid", "EuroHPC"],
  "founded": 2018,
  "description": "European quantum hardware manufacturer...",
  "website": "https://www.meetiqm.com",
  "featured": false,
  "logo": "/logos/iqm.svg"
}
```

**Why JSON files instead of a database:**
- $0 cost (no database to host)
- Git history = full audit trail
- Easy for Claude to generate and update
- Astro Content Collections validate the schema at build time
- Editable in any text editor or via GitHub's web UI

---

## 3. Project Structure

```
kvantiq-directory/
  src/
    layouts/
      BaseLayout.astro          # HTML shell, meta tags, nav, footer
    pages/
      index.astro               # Homepage
      about.astro
      submit.astro
      newsletter.astro
      companies/
        index.astro             # All companies grid
        [slug].astro            # Individual company page
        [country].astro         # Country filter page
      benchmarks/
        index.astro
        [slug].astro
      use-cases/
        index.astro
        [slug].astro
      challenges/
        index.astro
        [slug].astro
      resources/
        index.astro
    components/
      ListingCard.astro         # Reusable card for grids
      TagList.astro             # Tag pills
      SearchBar.astro           # Pagefind search widget
      NewsletterSignup.astro    # Email capture form
    content/
      config.ts                 # Astro Content Collections schema
    styles/
      global.css                # Tailwind CSS
  data/                         # JSON listings
  public/
    logos/                      # Company logos (SVG preferred)
    og-images/                  # Social sharing images
    llms.txt                    # AI discoverability
    llms-full.txt               # Full content for LLMs
    robots.txt                  # AI crawler permissions
  astro.config.mjs
  package.json
  tsconfig.json
```

---

## 4. Page Structure & URL Strategy

### Pages Generated from Data
| URL Pattern | Source | Example | SEO Target |
|---|---|---|---|
| `/companies/` | All companies | Index page | "quantum computing companies europe" |
| `/companies/[country]/` | Filtered | `/companies/finland/` | "quantum companies finland" |
| `/companies/[slug]/` | Single entry | `/companies/iqm/` | "IQM quantum computers" |
| `/benchmarks/` | All benchmarks | Index page | "quantum computing benchmarks" |
| `/benchmarks/[slug]/` | Single entry | `/benchmarks/vqe-hydrogen/` | "VQE hydrogen benchmark" |
| `/use-cases/` | All use cases | Index page | "quantum computing use cases" |
| `/use-cases/[slug]/` | Single entry | `/use-cases/drug-discovery/` | "quantum drug discovery" |
| `/challenges/` | All challenges | Index page | "quantum computing challenges" |
| `/resources/` | Courses, frameworks, funding | Index page | "quantum computing resources europe" |

### Static Pages
| URL | Purpose |
|---|---|
| `/` | Homepage — hero, featured listings, latest additions |
| `/about/` | What Kvantiq Directory is, who's behind it |
| `/submit/` | Form to suggest a new listing (Tally.so embed) |
| `/newsletter/` | Sign up for the Kvantiq newsletter |

### SEO Principles
- Every listing gets its own page (not just a row in a table)
- Country filter pages create long-tail landing pages
- Clean URLs, no query parameters
- Automatic sitemap generation via @astrojs/sitemap
- Structured data (JSON-LD) on every listing page

### Markdown Page Variants
Every listing page also available as `.md` for LLM consumption:
- `/companies/iqm.md` serves the same content as `/companies/iqm/` in raw Markdown
- Linked from `llms.txt` for AI tools that follow the spec

---

## 5. AI Search Optimization (LLM Discoverability)

### llms.txt (spec-compliant format)

Located at `/llms.txt`:

```markdown
# Kvantiq Directory

> The European directory for quantum computing — companies, benchmarks,
> use cases, and resources across Nordics and DACH.

Kvantiq Directory is a curated, structured database of the European
quantum computing ecosystem. All data is open and machine-readable.

## Companies

- [Quantum Companies Index](/companies/): Browse all listed quantum companies
- [Companies by Country](/companies/finland/): Filter by country

## Benchmarks

- [Quantum Benchmarks](/benchmarks/): Reproducible quantum computing benchmarks

## Use Cases

- [Hybrid Quantum-Classical Use Cases](/use-cases/): Real-world applications

## Challenges

- [Quantum Challenges](/challenges/): Competitions and hackathons

## Resources

- [Frameworks, Courses, Funding](/resources/): European quantum resources

## Optional

- [About Kvantiq](/about/): About the directory
- [Submit a Listing](/submit/): Suggest a new entry
```

Plus `llms-full.txt` that concatenates all listing content into one file for LLMs with large context windows.

### robots.txt — Explicit AI Crawler Permissions

```
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: claude-web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Googlebot
Allow: /

User-agent: cohere-ai
Allow: /

User-agent: YouBot
Allow: /

User-agent: DuckAssistBot
Allow: /

User-agent: MistralAI-User
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: CCBot
Allow: /

Sitemap: https://kvantiq.com/sitemap.xml
```

### Schema.org Structured Data per Page Type
| Page type | Schema type | Purpose |
|---|---|---|
| Company listing | `Organization` + `LocalBusiness` | LLMs extract company info |
| Benchmark entry | `Dataset` + `ScholarlyArticle` | Signals reproducible research |
| Use case page | `Article` + `HowTo` | Problem-solution format |
| Challenge/event | `Event` | Date, location, organizer |
| Resource/course | `LearningResource` | Educational content |
| All list pages | `ItemList` | Definitive list signal |
| FAQ sections | `FAQPage` | Directly extractable Q&A |
| All pages | `SpeakableSpecification` | Marks quotable sections |

### HTML Structure for LLM Extraction

Every listing page follows this structure:

```html
<main>
  <article>
    <h1>IQM Quantum Computers</h1>

    <!-- Citable one-liner (first sentence = what LLMs cite) -->
    <div class="summary" role="doc-abstract">
      <p>IQM is a Finnish quantum hardware manufacturer specializing
      in superconducting quantum processors for hybrid quantum-classical
      computing.</p>
      <ul>
        <li>Founded: <time datetime="2018">2018</time></li>
        <li>Country: Finland</li>
        <li>Focus: Superconducting quantum processors</li>
      </ul>
    </div>

    <!-- Question-format headings matching LLM queries -->
    <section>
      <h2>What does IQM do?</h2>
      <p>...</p>
    </section>

    <section>
      <h2>Where is IQM based?</h2>
      <p>...</p>
    </section>

    <!-- Auto-generated FAQ with FAQPage schema -->
    <section class="faq">
      <h2>Frequently Asked Questions</h2>
      <details>
        <summary>Is IQM involved in EuroHPC?</summary>
        <p>Yes. IQM is a EuroHPC partner...</p>
      </details>
    </section>
  </article>
</main>
```

### Index Page Comparison Tables

Category index pages include HTML `<table>` elements for company-vs-company and benchmark-vs-benchmark comparisons. LLMs frequently pull from tables when users ask comparison queries.

### Launch Actions for Discoverability
- Submit sitemap to Google Search Console AND Bing Webmaster Tools (Bing feeds ChatGPT and Perplexity)
- Post to r/QuantumComputing on Reddit
- Submit to Hacker News
- Get listed on Wikipedia's quantum computing resources section
- Request backlinks from DQC, Quantum Flagship, EuroHPC news sites

---

## 6. Monetization

### Tier 1 — Passive (no outreach needed)
- **Ad slots:** Reserved template placeholders. Add EthicalAds or Carbon Ads when traffic reaches ~1,000 monthly visitors.
- **Affiliate links:** Resource pages link to open-source quantum frameworks and privacy-respecting course platforms with affiliate tracking.
- **`featured: true` flag:** Featured listings get a badge, top placement, and a highlighted card. Free now — charge later.

### Tier 2 — Light outreach (when traffic grows)
- **Sponsored listing slots:** 1-2 "Sponsored" positions at the top of category pages.
- **Newsletter sponsorship:** Sell a sponsor slot per issue once list grows.
- **Job board:** `/jobs/` page. Charge per posting.

### Tier 3 — Premium (future)
- **Data/API access:** Sell the structured JSON dataset to enterprises.
- **Premium company profiles:** Enhanced pages with videos, case studies, team info.

**What gets built now:** Template placeholders and the `featured` flag only. Everything else is a future toggle.

---

## 7. Content Population Strategy

### Phase 1 — AI-assisted bulk population (launch)
Claude researches and generates the initial JSON entries. User reviews and approves batches.

| Category | Target count | Sources |
|---|---|---|
| Companies (Nordics + DACH) | 80-100 | Quantum Flagship participants, national quantum program grantees |
| Benchmarks | 30-40 | QED-C benchmarks, published papers, MQT Bench |
| Use cases | 20-30 | Industry case studies, EU project deliverables |
| Challenges/competitions | 10-15 | QHack, IBM challenges, EU hackathons |
| Resources (frameworks, courses, funding) | 40-50 | Open-source repos, MOOCs, EU/national funding calls |

### Phase 2 — Community submissions (post-launch)
`/submit/` page with a Tally.so form. Submissions arrive via email. ~5 minutes per submission to vet and add.

### Phase 3 — Automated freshness (later)
GitHub Action runs monthly to check for dead links. Flag stale entries for review. No auto-updating without user approval.

### Data Integrity Rules
- No fabricated or embellished company descriptions
- No listing companies that cannot be verified from public sources
- Only published, reproducible benchmark results

---

## 8. V1 Scope

### Ships in v1
- All page templates working with real data
- 200+ listings populated across all categories
- Pagefind search functional
- Newsletter signup form
- Submission form (Tally.so)
- Sitemap + structured data (JSON-LD)
- Mobile responsive
- llms.txt + llms-full.txt
- robots.txt with AI crawler permissions
- Markdown page variants
- FAQPage schema on auto-generated FAQs
- Semantic HTML5 structure
- Question-format H2 headings
- Summary blocks with `role="doc-abstract"`
- `<time datetime="">` on all dates
- Comparison tables on index pages

### Does NOT ship in v1
- Ads (need traffic first)
- Job board
- API access
- Automated freshness checks
- Analytics setup (defer until there's traffic to measure)
- Newsletter service connection (defer until there are subscribers)

---

## 9. Technical Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Astro | Static output, zero JS by default, Content Collections |
| Styling | Tailwind CSS | Utility-first, AI-friendly, no custom CSS maintenance |
| Search | Pagefind | Build-time index, client-side, zero hosting cost |
| Sitemap | @astrojs/sitemap | Auto-generates sitemap.xml |
| SEO meta | Astro built-in | `<head>` tags with Open Graph, JSON-LD |
| Deployment | Vercel | Free tier, auto-deploys on git push, edge CDN |
| Forms | Tally.so embed | GDPR-compliant, EU-hosted, free tier |
| Newsletter | Buttondown | Privacy-respecting, free up to 100 subscribers |
| Analytics | Plausible CE or Vercel Analytics | No cookies, no visitor profiling |
| Ads (future) | EthicalAds or Carbon Ads | No tracking, contextual only |
| Data storage | JSON files in git | $0, version-controlled, AI-editable |
