# Content Buildout Design Spec

**Date:** 2026-03-19
**Scope:** Bulk content population for all 5 collections to reach 190+ entries
**Out of scope:** Visual design changes, new page types, structural features

## Current State

| Collection | Current | Target | Gap |
|-----------|---------|--------|-----|
| Companies | 31 | 80-100 | ~50 |
| Resources | 12 | 40-50 | ~30 |
| Use Cases | 8 | 20-30 | ~15 |
| Benchmarks | 7 | 30-40 | ~25 |
| Challenges | 6 | 10-15 | ~6 |
| **Total** | **64** | **190+** | **~126** |

## Approach

Sequential waves in priority order. Each wave: research → write JSON → `npm run build` to validate → commit.

Parallel subagents within each wave to speed up research (e.g., 5 agents each researching 10 companies).

## Quality Rules

1. Every entry web-searched and verified from reputable sources
2. Minimum 2-3 sources per entry (company websites, press coverage, papers, EU project databases)
3. Sources must be reputable: peer-reviewed journals, major tech press (TechCrunch, CNBC, Nature, Science), official EU databases, company press releases, arXiv preprints
4. Description: 2-3 sentences, factual, no marketing language
5. All optional fields filled where data is publicly available
6. `dateAccessed` set to the date of research
7. Build-validate after each wave — invalid JSON must not ship

## Ethics Policy: Blocklisted Companies

Companies on the blocklist (AWS/Amazon, Google/Alphabet, Meta, surveillance-capitalism firms) are **included for completeness** but with modified linking:

- **Challenges/events** from blocklisted companies: `website` field uses a DuckDuckGo search URL instead of a direct link (e.g., `https://duckduckgo.com/?q=Google+Quantum+AI+Challenge+2026`). This avoids generating direct referral traffic.
- **Open-source frameworks** backed by blocklisted companies (e.g., Cirq, CUDA-Q): direct links are kept, since these tools serve the developer community and the projects themselves are open-source.
- **Company entries** for blocklisted companies: not added to the companies collection. The directory focuses on European tech sovereignty. Big tech quantum divisions are referenced in challenges/resources only.

## Wave 1: Companies (~50 new entries)

### Geographic Priority

**Tier 1 — Nordics (Denmark, Finland, Sweden, Norway):**
Target ~8 new entries. Research Danish, Swedish, Norwegian quantum startups and research spinouts. Finnish ecosystem already well-represented.

**Tier 2 — DACH (Germany, Austria, Switzerland):**
Target ~15 new entries. Germany has the largest EU quantum ecosystem by company count. Include Swiss quantum instrumentation companies (Zurich Instruments, Qnami), Austrian research spinouts, German hardware/software companies.

**Tier 3 — Broader Europe:**
Target ~27 new entries covering:
- Netherlands: QuTech spinouts, Delft-based companies
- France: Atos/Eviden Quantum, additional startups beyond Quandela/Alice&Bob/C12/Quobly
- Spain: Qilimanjaro, others
- UK: OQC, Riverlane, Quantinuum, ORCA Computing, Phasecraft, Universal Quantum, Quantum Motion, Nu Quantum
- Ireland, Italy, Poland, other emerging ecosystems

### Entry Structure
Match existing schema exactly (see `src/content.config.ts`):
```json
{
  "name": "...",
  "slug": "...",
  "country": "...",
  "region": "nordics|dach|western-europe|southern-europe|eastern-europe|uk",
  "type": "hardware|software|cloud|consulting|research|hybrid|other",
  "tags": ["..."],
  "founded": 2020,
  "description": "2-3 factual sentences.",
  "website": "https://...",
  "featured": false,
  "headquarters": "City, Country",
  "employees": "...",
  "funding": "...",
  "sources": [...]
}
```

### Region Mapping
- Nordics: Denmark, Finland, Sweden, Norway, Iceland
- DACH: Germany, Austria, Switzerland
- Western Europe: France, Netherlands, Belgium, Luxembourg, Ireland
- Southern Europe: Spain, Italy, Portugal, Greece
- Eastern Europe: Poland, Czech Republic, Romania, Hungary, etc.
- UK: United Kingdom

## Wave 2: Resources (~30 new entries)

### Required Fields
```json
{
  "name": "...",
  "slug": "...",
  "type": "framework|course|funding|tool|community|publication|other",
  "tags": ["..."],
  "description": "2-3 factual sentences.",
  "website": "https://...",
  "openSource": true,
  "free": true,
  "language": "Python",
  "provider": "...",
  "sources": [...]
}
```
`language` and `provider` are optional. `openSource`, `free` are required booleans.

### Categories

**Frameworks/Tools (~10 new):**
European-first, open-source priority. Perceval (Quandela), myQLM (Atos/Eviden), QuTiP, OpenQASM, Stim, Mitiq, Qibo, NetQASM, and others verified as active projects.

**Courses/Learning (~8 new):**
QWorld, TU Delft quantum courses, ETH Zurich, Qiskit Textbook, Xanadu Codebook, CERN QTI materials, European Quantum Readiness Center.

**Funding/Programs (~6 new):**
EIC Quantum Fund, Quantum Flagship projects, German BMBF, French National Quantum Plan, Nordic programs, EuroHPC quantum.

**Communities (~6 new):**
QuIC (European Quantum Industry Consortium), Quantum Internet Alliance, QURECA, OpenQuantumSafe, national quantum communities.

## Wave 3: Use Cases (~15 new entries)

### Industries

- **Finance (3):** Credit risk modeling, fraud detection, derivatives pricing
- **Logistics/Manufacturing (3):** Production scheduling, warehouse optimization, aircraft loading
- **Pharma/Chemistry (2):** Protein folding, catalyst design for green hydrogen
- **Energy (2):** Battery materials simulation, carbon capture modeling
- **Telecom/Cybersecurity (3):** QKD networks, network optimization, QRNG
- **Climate/Weather (2):** Weather forecasting, carbon emissions optimization

### Required Fields
```json
{
  "name": "...",
  "slug": "...",
  "industry": "...",
  "category": "optimization|simulation|machine-learning|cryptography|chemistry|finance|logistics|energy|other",
  "tags": ["..."],
  "description": "2-3 factual sentences.",
  "problem": "Description of the problem being solved.",
  "approach": "How quantum computing is applied.",
  "results": "Published results if available.",
  "companies": ["company-slug-1"],
  "sources": [...]
}
```
`problem` and `approach` are **required**. `results` and `companies` are optional.

### Category Mapping
- Finance entries → `finance`
- Logistics/Manufacturing → `logistics`
- Pharma/Chemistry → `chemistry`
- Energy → `energy`
- Telecom/Cybersecurity: QKD/QRNG → `cryptography`, network optimization → `optimization`
- Climate/Weather → `simulation`

## Wave 4: Benchmarks (~25 new entries)

### Required Fields
```json
{
  "name": "...",
  "slug": "...",
  "algorithm": "Name of the algorithm or method being benchmarked",
  "category": "optimization|simulation|machine-learning|cryptography|chemistry|other",
  "tags": ["..."],
  "description": "2-3 factual sentences.",
  "hardware": "Hardware platform if applicable",
  "framework": "Software framework used",
  "qubits": 10,
  "reproducible": true,
  "datePublished": "2025-01-01",
  "sources": [...]
}
```
`algorithm` is **required**. `hardware`, `framework`, `qubits`, `reproducible`, `datePublished` are optional.

### Categories

- **Optimization → `optimization` (6):** TSP, larger Max-Cut, knapsack, QUBO sets, approximate counting, portfolio optimization
- **Simulation → `simulation` (3):** Hubbard model, Ising model, Fermi-Hubbard
- **Chemistry → `chemistry` (3):** LiH, N₂ dissociation, H₂O
- **Hardware/System → `other` (6):** CLOPS, algorithmic qubits, mirror circuits, XEB, randomized benchmarking, individual QED-C applications
- **ML/Classification → `machine-learning` (4):** Quantum kernel methods, QNN classification, generative models, variational classifiers
- **Cryptography → `cryptography` (3):** Shor's (small instances), Grover scaling, QKD throughput

Source standard: arXiv, published journals, official framework docs. Prioritize reproducible benchmarks with public code/data.

## Wave 5: Challenges (~6 new entries)

EU-based hackathons and competitions, plus big-tech challenges using DuckDuckGo links:
- CERN Quantum Computing Challenge
- QHack 2026 (Xanadu)
- European Quantum Computing Challenge
- Classiq Coding Competition
- Quantum Game Jam
- Blaise Pascal Quantum Challenge or other verified EU events

Google/AWS challenges included with `website` as DuckDuckGo search URL per ethics policy.

## Validation

After each wave:
1. `npm run build` — schema validation catches any malformed entries
2. Spot-check 3-5 entries manually: do sources resolve? Is data accurate?
3. Commit with descriptive message per wave

## Success Criteria

- 190+ total entries across all collections
- Every entry has 2+ verified, reputable sources
- `npm run build` succeeds cleanly
- No blocklisted company receives direct link traffic (except open-source frameworks)
- Nordics + DACH companies represent majority of company entries
