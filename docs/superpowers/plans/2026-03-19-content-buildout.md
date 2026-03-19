# Content Buildout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate all 5 content collections to 190+ total entries with web-researched, source-verified data.

**Architecture:** Sequential waves by collection priority (companies → resources → use cases → benchmarks → challenges). Within each wave, parallel subagents handle geographic/category batches. Each batch: web-research → write JSON → build-validate → commit.

**Tech Stack:** Astro Content Collections (JSON + Zod), web search for research, `npm run build` for validation.

**Working directory:** `E:\kvantiq-directory\.worktrees\feature-directory-site\`

**Spec:** `docs/superpowers/specs/2026-03-19-content-buildout-design.md`

---

## File Structure

All new files are JSON in `src/content/{collection}/`. No code changes — only content additions.

```
src/content/companies/    — ~50 new .json files
src/content/resources/    — ~30 new .json files
src/content/use-cases/    — ~15 new .json files
src/content/benchmarks/   — ~25 new .json files
src/content/challenges/   — ~6 new .json files
```

Filename convention: `{slug}.json` (lowercase, hyphenated). Slug must match the `"slug"` field inside the JSON.

---

## Reference: Existing Slugs (Do Not Duplicate)

**Companies (31):** algorithmiq, alice-and-bob, aqora, aqt, arctic-instruments, bluefors, bosch-quantum-sensing, c12, eleqtron, hqs, id-quantique, iqm, keequant, kiutra, multiverse-computing, orange-quantum-systems, parityqc, pasqal, planqc, q-ant, qblox, qmill, quandela, quanscient, quantastica, quantware, quobly, semiqon, sparrow-quantum, terra-quantum, xiphera

**Resources (12):** cirq, cuda-q, eu-quantum-flagship, finnish-quantum-flagship, ibm-quantum-learning, mqt, pennylane, qiskit, qosf, quantum-katas, strawberry-fields, tket

**Use Cases (8):** cryptography-post-quantum, drug-discovery-hybrid, energy-grid-optimization, portfolio-optimization, quantum-chemistry-materials, quantum-machine-learning-classification, supply-chain-optimization, vehicle-routing-optimization

**Benchmarks (7):** mqt-bench, q-score, qaoa-maxcut, qed-c-benchmarks, quantum-volume, supermarq, vqe-hydrogen

**Challenges (6):** airbus-bmw-quantum-challenge, berlin-quantum-hackathon, ibm-quantum-challenge, iquhack-2026, qhack-2025, qosf-monthly-challenges

---

## Reference: Schema Templates

### Company Template
```json
{
  "name": "Company Name",
  "slug": "company-slug",
  "country": "Country",
  "region": "nordics|dach|western-europe|southern-europe|eastern-europe|uk",
  "type": "hardware|software|cloud|consulting|research|hybrid|other",
  "tags": ["tag1", "tag2"],
  "founded": 2020,
  "description": "2-3 factual sentences about the company.",
  "website": "https://example.com",
  "featured": false,
  "headquarters": "City, Country",
  "employees": "50+",
  "funding": "EUR 10M+",
  "sources": [
    {
      "type": "website",
      "url": "https://example.com",
      "title": "Company Official Website",
      "dateAccessed": "2026-03-19"
    },
    {
      "type": "press-release",
      "url": "https://news-source.com/article",
      "title": "Article Title",
      "dateAccessed": "2026-03-19"
    }
  ]
}
```

### Resource Template
```json
{
  "name": "Resource Name",
  "slug": "resource-slug",
  "type": "framework|course|funding|tool|community|publication|other",
  "tags": ["tag1", "tag2"],
  "description": "2-3 factual sentences.",
  "website": "https://example.com",
  "openSource": true,
  "free": true,
  "language": "Python",
  "provider": "Provider Name",
  "sources": [
    {
      "type": "website",
      "url": "https://example.com",
      "title": "Resource Official Website",
      "dateAccessed": "2026-03-19"
    }
  ]
}
```

### Use Case Template
```json
{
  "name": "Use Case Name",
  "slug": "use-case-slug",
  "industry": "Industry Name",
  "category": "optimization|simulation|machine-learning|cryptography|chemistry|finance|logistics|energy|other",
  "tags": ["tag1", "tag2"],
  "description": "2-3 factual sentences.",
  "problem": "Description of the problem being solved. Required field.",
  "approach": "How quantum computing is applied to this problem. Required field.",
  "results": "Published results if available.",
  "companies": ["company-slug"],
  "sources": [
    {
      "type": "arxiv",
      "url": "https://arxiv.org/abs/XXXX.XXXXX",
      "title": "Paper Title",
      "dateAccessed": "2026-03-19"
    }
  ]
}
```

### Benchmark Template
```json
{
  "name": "Benchmark Name",
  "slug": "benchmark-slug",
  "algorithm": "Name of the algorithm or method being benchmarked. Required field.",
  "category": "optimization|simulation|machine-learning|cryptography|chemistry|other",
  "tags": ["tag1", "tag2"],
  "description": "2-3 factual sentences.",
  "hardware": "Hardware platform if applicable",
  "framework": "Software framework used",
  "qubits": 10,
  "reproducible": true,
  "datePublished": "2025-01-01",
  "sources": [
    {
      "type": "arxiv",
      "url": "https://arxiv.org/abs/XXXX.XXXXX",
      "title": "Paper Title",
      "dateAccessed": "2026-03-19"
    }
  ]
}
```

### Challenge Template
```json
{
  "name": "Challenge Name",
  "slug": "challenge-slug",
  "organizer": "Organizer Name",
  "tags": ["tag1", "tag2"],
  "description": "2-3 factual sentences.",
  "website": "https://example.com",
  "dateStart": "2026-01-01",
  "dateEnd": "2026-01-31",
  "status": "upcoming|active|completed",
  "prizes": "Prize description",
  "location": "Online|City, Country",
  "sources": [
    {
      "type": "website",
      "url": "https://example.com",
      "title": "Challenge Official Website",
      "dateAccessed": "2026-03-19"
    }
  ]
}
```

---

## Reference: Quality Rules

1. Every entry web-searched and verified from reputable sources (company websites, TechCrunch, CNBC, Nature, Science, EU databases, arXiv)
2. Minimum 2 sources per entry (ideally 3)
3. Description: 2-3 sentences, factual, no marketing language
4. All optional fields filled where data is publicly available
5. `dateAccessed` set to date of research
6. Blocklisted companies (Google, AWS, Meta) in challenges use DuckDuckGo URLs: `https://duckduckgo.com/?q=Company+Challenge+Name`
7. Open-source frameworks from blocklisted companies keep direct links
8. No blocklisted companies in the companies collection

---

## Reference: Region Mapping

| Region Value | Countries |
|-------------|-----------|
| `nordics` | Denmark, Finland, Sweden, Norway, Iceland |
| `dach` | Germany, Austria, Switzerland |
| `western-europe` | France, Netherlands, Belgium, Luxembourg, Ireland |
| `southern-europe` | Spain, Italy, Portugal, Greece |
| `eastern-europe` | Poland, Czech Republic, Romania, Hungary, etc. |
| `uk` | United Kingdom |

---

## Wave 1: Companies (~50 new entries)

### Task 1: Nordic Companies (~8 new)

**Files:**
- Create: `src/content/companies/{slug}.json` — ~8 files

**Target companies (research and verify each exists):**
Danish: Kvantify, SaxonQ, Sparrow Quantum (already exists — skip), QDevil/Quantum Machines Denmark operations
Swedish: Chalmers-spinout companies, Qnami Nordic
Norwegian: Diraq Norway, Quantum Brilliance (AU/NO — check European HQ)
Finnish: check for any not already covered

**Research approach:** Web search each company name + "quantum computing" + country. Verify: active website, real employees, real funding/product. Use company website + one news/press source minimum.

- [ ] **Step 1: Research Nordic quantum companies via web search**

Search for quantum computing companies in Denmark, Sweden, Norway. Cross-reference with EU Quantum Flagship participant lists, Nordic quantum ecosystem reports. Verify each company has an active website.

- [ ] **Step 2: Write JSON files for verified companies**

Create one `.json` file per company in `src/content/companies/`. Follow company template exactly. Set `region: "nordics"`. Include 2-3 verified sources per entry. Skip any that duplicate existing slugs.

- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`
Expected: Build succeeds with no schema validation errors.

- [ ] **Step 4: Commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add src/content/companies/
git commit -m "content: add Nordic quantum companies"
```

---

### Task 2: DACH Companies — Germany (~10 new)

**Files:**
- Create: `src/content/companies/{slug}.json` — ~10 files

**Target companies (research and verify):**
German quantum ecosystem is the largest in EU. Look for: Infineon Quantum, SEEQC Europe, Quantum Optics Jena, IQM Germany operations (skip — IQM already listed), Duality Quantum Photonics, Kiutra (already exists — skip), Black Semiconductor, Twenty-One Semiconductors, NXP Quantum, Q.ant (already exists — skip), HQS (already exists — skip), eleQtron (already exists — skip), planqc (already exists — skip)

**Research approach:** Search "quantum computing companies Germany", check BMBF quantum initiative participant lists, German Quantum Computing Initiative members.

- [ ] **Step 1: Research German quantum companies via web search**

Search for quantum computing startups and companies in Germany. Cross-reference BMBF/DLR quantum funding recipients. Verify active websites and real operations.

- [ ] **Step 2: Write JSON files for verified companies**

Create `.json` files. Set `region: "dach"`, `country: "Germany"`. Include 2-3 verified sources.

- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add src/content/companies/
git commit -m "content: add German quantum companies"
```

---

### Task 3: DACH Companies — Austria & Switzerland (~5 new)

**Files:**
- Create: `src/content/companies/{slug}.json` — ~5 files

**Target companies:**
Austria: AQT (already exists — skip), ParityQC (already exists — skip), additional Austrian quantum
Switzerland: Zurich Instruments, Qnami, Terra Quantum (already exists — skip), ID Quantique (already exists — skip, listed as Switzerland), additional Swiss quantum

**Research approach:** Search Austrian/Swiss quantum ecosystems, check university spinout lists (ETH Zurich, University of Innsbruck, TU Wien).

- [ ] **Step 1: Research Austrian and Swiss quantum companies via web search**
- [ ] **Step 2: Write JSON files for verified companies**

Set `region: "dach"`. Country: "Austria" or "Switzerland".

- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`

- [ ] **Step 4: Commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add src/content/companies/
git commit -m "content: add Austrian and Swiss quantum companies"
```

---

### Task 4: UK Companies (~8 new)

**Files:**
- Create: `src/content/companies/{slug}.json` — ~8 files

**Target companies:**
OQC (Oxford Quantum Circuits), Riverlane, Quantinuum (US/UK — check European HQ), ORCA Computing, Phasecraft, Universal Quantum, Quantum Motion, Nu Quantum, Rahko (check if still active), Cambridge Quantum (merged into Quantinuum — skip if so)

**Research approach:** Search UK quantum computing ecosystem, check UKRI quantum funding recipients, National Quantum Computing Centre partners.

- [ ] **Step 1: Research UK quantum companies via web search**
- [ ] **Step 2: Write JSON files for verified companies**

Set `region: "uk"`, `country: "United Kingdom"`.

- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`

- [ ] **Step 4: Commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add src/content/companies/
git commit -m "content: add UK quantum companies"
```

---

### Task 5: France & Benelux Companies (~8 new)

**Files:**
- Create: `src/content/companies/{slug}.json` — ~8 files

**Target companies:**
France: Atos/Eviden Quantum, Quandela (exists — skip), Alice & Bob (exists — skip), C12 (exists — skip), Quobly (exists — skip), additional French quantum startups (Pasqal exists — skip)
Netherlands: Delft Circuits, QuTech spinouts, QuantWare (exists — skip), Qblox (exists — skip), Orange QS (exists — skip), QphoX, Qu & Co (check if merged)
Belgium: Quantum Application Lab, additional

**Research approach:** Search French/Dutch quantum ecosystems, check EU Quantum Flagship funded companies.

- [ ] **Step 1: Research French and Benelux quantum companies via web search**
- [ ] **Step 2: Write JSON files for verified companies**

France: `region: "western-europe"`. Netherlands/Belgium: `region: "western-europe"`.

- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`

- [ ] **Step 4: Commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add src/content/companies/
git commit -m "content: add French and Benelux quantum companies"
```

---

### Task 6: Southern & Eastern Europe Companies (~6 new)

**Files:**
- Create: `src/content/companies/{slug}.json` — ~6 files

**Target companies:**
Spain: Qilimanjaro, Multiverse Computing (exists — skip), additional Spanish quantum
Italy: Italian quantum startups (note: Algorithmiq sounds Italian but is Finnish — already listed, do not re-add)
Poland: Beit, additional Polish quantum
Other: Czech, Hungarian, Romanian quantum startups

**Research approach:** Search quantum computing companies in Southern/Eastern Europe. These ecosystems are smaller — may yield fewer verified entries.

- [ ] **Step 1: Research Southern and Eastern European quantum companies**
- [ ] **Step 2: Write JSON files for verified companies**

Use appropriate region values: `southern-europe` or `eastern-europe`.

- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`

- [ ] **Step 4: Commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add src/content/companies/
git commit -m "content: add Southern and Eastern European quantum companies"
```

---

### Task 7: Wave 1 Final Validation

- [ ] **Step 1: Count total company entries**

Run: `ls E:/kvantiq-directory/.worktrees/feature-directory-site/src/content/companies/*.json | wc -l`
Expected: 75+ files (31 existing + ~45-50 new)

- [ ] **Step 2: Full build validation**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`
Expected: Clean build, no errors.

- [ ] **Step 3: Check for duplicate slugs**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && cat src/content/companies/*.json | grep '"slug"' | sort | uniq -d`
Expected: No output (no duplicates).

- [ ] **Step 4: Spot-check 3-5 entries**

Pick 3-5 newly added company entries at random. For each: open the source URLs in a browser or via `curl -sI` to verify they resolve (HTTP 200). Verify the description matches what the source says.

- [ ] **Step 5: Verify Nordics + DACH majority**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && cat src/content/companies/*.json | grep '"region"' | sort | uniq -c | sort -rn`
Expected: `nordics` + `dach` entries together exceed 50% of total.

---

## Wave 2: Resources (~30 new entries)

### Task 8: Framework & Tool Resources (~10 new)

**Files:**
- Create: `src/content/resources/{slug}.json` — ~10 files

**Target resources (European-first, open-source priority):**
Perceval (Quandela photonic framework), myQLM (Atos/Eviden), QuTiP (quantum toolbox in Python), OpenQASM (quantum assembly language), Stim (Google — keep direct link, open-source), Mitiq (Unitary Fund error mitigation), Qibo (EU-developed), NetQASM (QuTech), Amazon Braket SDK (blocklisted — SKIP), Pulser (Pasqal), Ocean SDK (D-Wave)

Set `type: "framework"` or `type: "tool"` as appropriate.

- [ ] **Step 1: Research quantum frameworks and tools via web search**
- [ ] **Step 2: Write JSON files for verified resources**
- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`

- [ ] **Step 4: Commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add src/content/resources/
git commit -m "content: add quantum framework and tool resources"
```

---

### Task 9: Course & Learning Resources (~8 new)

**Files:**
- Create: `src/content/resources/{slug}.json` — ~8 files

**Target resources:**
QWorld (EU quantum education nonprofit), TU Delft Quantum courses (edX), ETH Zurich quantum courses, Qiskit Textbook (open, free), Xanadu Codebook, CERN QTI materials, Brilliant.org quantum courses (check if appropriate), Quantum Computing UK courses

Set `type: "course"`.

- [ ] **Step 1: Research quantum learning resources via web search**
- [ ] **Step 2: Write JSON files for verified resources**
- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`

- [ ] **Step 4: Commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add src/content/resources/
git commit -m "content: add quantum course and learning resources"
```

---

### Task 10: Funding & Community Resources (~12 new)

**Files:**
- Create: `src/content/resources/{slug}.json` — ~12 files

**Funding targets (~6):** Set `type: "funding"`.
EIC Quantum Fund, German BMBF Quantum Initiative, French National Quantum Plan, EuroHPC Quantum, Nordic Quantum Computing program, Quantum Flagship Phase 2

**Community targets (~6):** Set `type: "community"`.
QuIC (European Quantum Industry Consortium), Quantum Internet Alliance, QURECA, OpenQuantumSafe, DQC (Danish Quantum Community), Quantum.Amsterdam

- [ ] **Step 1: Research quantum funding programs and communities via web search**
- [ ] **Step 2: Write JSON files for verified resources**
- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`

- [ ] **Step 4: Commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add src/content/resources/
git commit -m "content: add quantum funding and community resources"
```

---

### Task 11: Wave 2 Final Validation

- [ ] **Step 1: Count total resource entries**

Run: `ls E:/kvantiq-directory/.worktrees/feature-directory-site/src/content/resources/*.json | wc -l`
Expected: 40+ files.

- [ ] **Step 2: Full build validation**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`

- [ ] **Step 3: Check for duplicate slugs**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && cat src/content/resources/*.json | grep '"slug"' | sort | uniq -d`
Expected: No duplicates.

- [ ] **Step 4: Spot-check 3-5 entries**

Pick 3-5 newly added resource entries at random. Verify source URLs resolve and description is accurate.

---

## Wave 3: Use Cases (~15 new entries)

### Task 12: Finance & Logistics Use Cases (~6 new)

**Files:**
- Create: `src/content/use-cases/{slug}.json` — ~6 files

**Finance (3):** `category: "finance"`
- Credit risk modeling (quantum Monte Carlo)
- Fraud detection (quantum ML classification)
- Derivatives pricing (quantum amplitude estimation)

**Logistics (3):** `category: "logistics"`
- Production scheduling optimization
- Warehouse layout optimization
- Aircraft loading optimization

Each entry MUST include `problem` (required) and `approach` (required) fields. Source from published papers or industry reports.

- [ ] **Step 1: Research finance and logistics quantum use cases via web search**
- [ ] **Step 2: Write JSON files with problem/approach/results fields**
- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`

- [ ] **Step 4: Commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add src/content/use-cases/
git commit -m "content: add finance and logistics quantum use cases"
```

---

### Task 13: Science & Energy Use Cases (~5 new)

**Files:**
- Create: `src/content/use-cases/{slug}.json` — ~5 files

**Pharma/Chemistry (2):** `category: "chemistry"`
- Protein folding simulation
- Catalyst design for green hydrogen

**Energy (2):** `category: "energy"`
- Battery materials simulation
- Carbon capture molecular modeling

**Climate (1):** `category: "simulation"`
- Weather forecasting (quantum-enhanced)

- [ ] **Step 1: Research science and energy quantum use cases via web search**
- [ ] **Step 2: Write JSON files with problem/approach/results fields**
- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`

- [ ] **Step 4: Commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add src/content/use-cases/
git commit -m "content: add science and energy quantum use cases"
```

---

### Task 14: Telecom & Remaining Use Cases (~4 new)

**Files:**
- Create: `src/content/use-cases/{slug}.json` — ~4 files

**Telecom/Cybersecurity (3):**
- QKD networks → `category: "cryptography"`
- Network optimization → `category: "optimization"`
- QRNG (quantum random number generation) → `category: "cryptography"`

**Climate (1):** `category: "simulation"`
- Carbon emissions optimization

- [ ] **Step 1: Research telecom and remaining quantum use cases via web search**
- [ ] **Step 2: Write JSON files with problem/approach/results fields**
- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`

- [ ] **Step 4: Commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add src/content/use-cases/
git commit -m "content: add telecom and remaining quantum use cases"
```

---

### Task 15: Wave 3 Final Validation

- [ ] **Step 1: Count total use case entries**

Run: `ls E:/kvantiq-directory/.worktrees/feature-directory-site/src/content/use-cases/*.json | wc -l`
Expected: 22+ files.

- [ ] **Step 2: Full build validation and duplicate check**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build && cat src/content/use-cases/*.json | grep '"slug"' | sort | uniq -d`

- [ ] **Step 3: Spot-check 3-5 entries**

Pick 3-5 newly added use case entries at random. Verify source URLs resolve and problem/approach fields are accurate.

---

## Wave 4: Benchmarks (~25 new entries)

### Task 16: Optimization & Chemistry Benchmarks (~9 new)

**Files:**
- Create: `src/content/benchmarks/{slug}.json` — ~9 files

**Optimization (6):** `category: "optimization"`
- TSP benchmark, Max-Cut extended, Knapsack, QUBO benchmark set, Quantum approximate counting, Portfolio optimization benchmark

**Chemistry (3):** `category: "chemistry"`
- LiH ground state, N₂ dissociation curve, H₂O simulation

Each entry MUST include `algorithm` (required). Source from arXiv or published journals.

- [ ] **Step 1: Research optimization and chemistry benchmarks via web search**
- [ ] **Step 2: Write JSON files with algorithm field**
- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`

- [ ] **Step 4: Commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add src/content/benchmarks/
git commit -m "content: add optimization and chemistry quantum benchmarks"
```

---

### Task 17: Simulation & Hardware Benchmarks (~9 new)

**Files:**
- Create: `src/content/benchmarks/{slug}.json` — ~9 files

**Simulation (3):** `category: "simulation"`
- Hubbard model, Transverse-field Ising model, Fermi-Hubbard

**Hardware/System (6):** `category: "other"`
- CLOPS, Algorithmic qubits, Mirror circuits, XEB (cross-entropy benchmarking), Randomized benchmarking, QED-C application-specific

- [ ] **Step 1: Research simulation and hardware benchmarks via web search**
- [ ] **Step 2: Write JSON files with algorithm field**
- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`

- [ ] **Step 4: Commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add src/content/benchmarks/
git commit -m "content: add simulation and hardware quantum benchmarks"
```

---

### Task 18: ML & Cryptography Benchmarks (~7 new)

**Files:**
- Create: `src/content/benchmarks/{slug}.json` — ~7 files

**ML/Classification (4):** `category: "machine-learning"`
- Quantum kernel methods, QNN classification, Quantum generative models, Variational classifier

**Cryptography (3):** `category: "cryptography"`
- Shor's algorithm (small factoring), Grover search scaling, QKD throughput

- [ ] **Step 1: Research ML and cryptography benchmarks via web search**
- [ ] **Step 2: Write JSON files with algorithm field**
- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`

- [ ] **Step 4: Commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add src/content/benchmarks/
git commit -m "content: add ML and cryptography quantum benchmarks"
```

---

### Task 19: Wave 4 Final Validation

- [ ] **Step 1: Count total benchmark entries**

Run: `ls E:/kvantiq-directory/.worktrees/feature-directory-site/src/content/benchmarks/*.json | wc -l`
Expected: 30+ files.

- [ ] **Step 2: Full build validation and duplicate check**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build && cat src/content/benchmarks/*.json | grep '"slug"' | sort | uniq -d`

- [ ] **Step 3: Spot-check 3-5 entries**

Pick 3-5 newly added benchmark entries at random. Verify source URLs resolve and algorithm field is accurate.

---

## Wave 5: Challenges (~6 new entries)

### Task 20: New Challenges

**Files:**
- Create: `src/content/challenges/{slug}.json` — ~6 files

**EU/Independent challenges (direct links):**
- CERN Quantum Computing Challenge
- QHack 2026 (Xanadu) — if announced
- European Quantum Computing Challenge (EU Flagship)
- Classiq Coding Competition
- Quantum Game Jam
- Blaise Pascal Quantum Challenge or similar EU event

**Big tech challenges (DuckDuckGo links):**
If adding Google/AWS challenges, set `website` to:
`https://duckduckgo.com/?q=Google+Quantum+AI+Challenge` (not a direct link)

- [ ] **Step 1: Research quantum challenges and competitions via web search**

Verify each challenge exists/existed. Check dates, organizers, prize info.

- [ ] **Step 2: Write JSON files for verified challenges**

Set `status` correctly: "upcoming", "active", or "completed" based on dates vs today (2026-03-19).

- [ ] **Step 3: Build-validate**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build`

- [ ] **Step 4: Commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add src/content/challenges/
git commit -m "content: add quantum challenges and competitions"
```

---

### Task 21: Wave 5 Validation

- [ ] **Step 1: Count total challenge entries**

Run: `ls E:/kvantiq-directory/.worktrees/feature-directory-site/src/content/challenges/*.json | wc -l`
Expected: 10+ files.

- [ ] **Step 2: Build validation and duplicate check**

Run: `cd E:/kvantiq-directory/.worktrees/feature-directory-site && npm run build && cat src/content/challenges/*.json | grep '"slug"' | sort | uniq -d`

- [ ] **Step 3: Spot-check entries**

Verify source URLs resolve. For DuckDuckGo-linked challenges, verify the search query returns relevant results.

---

## Final Validation

### Task 22: Full Directory Validation

- [ ] **Step 1: Count all entries**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
echo "Companies: $(ls src/content/companies/*.json | wc -l)"
echo "Resources: $(ls src/content/resources/*.json | wc -l)"
echo "Use Cases: $(ls src/content/use-cases/*.json | wc -l)"
echo "Benchmarks: $(ls src/content/benchmarks/*.json | wc -l)"
echo "Challenges: $(ls src/content/challenges/*.json | wc -l)"
```
Expected: 190+ total across all collections.

- [ ] **Step 2: Full clean build**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
rm -rf dist .astro
npm run build
```
Expected: Clean build, all pages generated, Pagefind indexes all content.

- [ ] **Step 3: Check for any duplicate slugs across all collections**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
for dir in companies resources use-cases benchmarks challenges; do
  echo "=== $dir ==="
  cat src/content/$dir/*.json | grep '"slug"' | sort | uniq -d
done
```
Expected: No duplicates in any collection.

- [ ] **Step 4: Verify Nordics + DACH majority in companies**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
cat src/content/companies/*.json | grep '"region"' | sort | uniq -c | sort -rn
```
Expected: `nordics` + `dach` counts together exceed 50% of total company entries.

- [ ] **Step 5: Verify page count**

Check build output for total pages generated. Should be significantly higher than current 63.

- [ ] **Step 6: Final commit**

```bash
cd E:/kvantiq-directory/.worktrees/feature-directory-site
git add -A
git commit -m "content: complete directory buildout — 190+ entries across all collections"
```
