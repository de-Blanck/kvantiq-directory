# Source contradictions — worklist

**Generated:** 2026-09-01 · **Open:** 53 · **Resolved:** 0

**Sources:** the 2026-09-01 full sweep cross-check (48, PR #88) + the backlog consolidation (5, PR #85)

Each entry below asserts something its sources do not jointly support, or has
sources that disagree with each other. CLAUDE.md → "Cross-checking" requires
resolution before publishing, and no automated pass can do it: `ai-sweep.mjs`
writes only `news` and `sources`, never `founded`, `funding`, `country` or
`highlights`.

Resolution rule (CLAUDE.md → "Source credibility"): prefer the higher-credibility
source, and never publish a claim the sources cannot jointly substantiate. A
company press release counts once and needs two independent confirmations.

Tick a box only once the entry is edited **and** the resolving source is recorded
in its `sources` array. The recurring themes are founding years, funding totals,
and headquarters cities — the fields the weekly sweep has never been able to touch.

## A. Sweep cross-check (48)

- [x] **`benchmarks/lih-ground-state.json`** — resolved 2026-09-02 (PR #93) — arXiv:2502.09595 is BenchQC, benchmarking aluminium clusters; replaced with Kandala et al. (arXiv:1704.05018), the canonical hardware LiH VQE result
      - Entry describes benchmark for lithium hydride (LiH), but fetched source (arxiv.org/abs/2502.09595) benchmarks aluminum clusters (Al⁻, Al₂, Al₃⁻) instead.
- [ ] **`benchmarks/mqt-bench.json`**
      - Entry states 'over 70 algorithm implementations'; all three sources consistently state 'more than 70,000 benchmark circuits' — a significant numerical and conceptual discrepancy in describing MQT Bench's content.
- [x] **`benchmarks/portfolio-optimization.json`** — resolved 2026-09-02 (PR #93) — restated to match arXiv:2509.17876: classical MIP and tailored heuristics significantly outperform quantum at fixed time budgets
      - Entry states quantum methods 'minimize cost functions effectively,' but Source 1 (arXiv:2509.17876) concludes classical heuristics consistently outperform quantum approaches with 'only very limited room for potential quantum advantage.'
- [x] **`benchmarks/qaoa-maxcut.json`** — resolved 2026-09-02 (PR #93) — Farhi et al. analyse 2- and 3-regular graphs; description no longer attributes "random graphs" to that paper
      - Entry states benchmark tests 'random graphs', but the original QAOA paper (arXiv:1411.4028) explicitly analyzes performance on '2-regular and 3-regular graphs' (regular graphs, not random).
- [x] **`benchmarks/quantum-kernel-methods.json`** — resolved 2026-09-02 (PR #93) — arXiv:2409.04406 covers "both classification and regression tasks"
      - Entry describes benchmark as 'for classification tasks' but source 2409.04406 explicitly states it encompasses 'both classification and regression tasks'
- [x] **`benchmarks/quantum-volume.json`** — dismissed 2026-09-02 (PR #93) — the flag rests on Wikipedia, which CLAUDE.md excludes. IBM's own paper (arXiv:1811.12926) states "We introduce a single-number metric, quantum volume"; the Moll et al. abstract only discusses it
      - Entry says 'developed by IBM' but Wikipedia states originally defined by Nikolaj Moll et al. (2018), with IBM providing a 2019 redefinition
- [x] **`benchmarks/supermarq.json`** — resolved 2026-09-02 (PR #93) — category optimization -> other; it is a benchmark suite
      - Entry Type field states 'optimization', but all fetched sources consistently describe SupermarQ as a 'benchmark suite' for measuring quantum hardware performance, not an optimization tool.
- [x] **`benchmarks/weighted-maxcut.json`** — resolved 2026-09-02 (PR #93) — arXiv:2505.24191 compares QWOA against two classical local-search heuristics, not against QAOA
      - Entry states 'Recent work compares QAOA with non-variational quantum walk algorithms' but arxiv 2505.24191 compares QWOA with two classical local-search heuristics, not QAOA.
- [ ] **`challenges/berlin-quantum-hackathon.json`**
      - Entry states '6-week hybrid event' but the official hackathon website (berlinquantumhackathon.com) states '5 Weeks Coding + Mentorship'
- [ ] **`challenges/ibm-quantum-challenge.json`**
      - Entry claims 'biannual' event, but Quantum Insider states it is 'an annual educational coding contest'
      - Entry emphasizes participants solve problems 'using IBM Qiskit and real quantum hardware,' but 2024 challenge explicitly 'will focus on software simulation rather than requiring hardware use'
- [ ] **`challenges/quantum-game-jam-2025.json`**
      - Entry states event ran October 5–7, 2025, but itch.io (official jam page) states it ran September 5–8, 2025.
- [ ] **`companies/adamantq.json`**
      - Company name: entry lists 'AdamantQ' but both Navigare Ventures and Industrifonden sources consistently refer to the company as 'Adamant Quanta'
- [x] **`companies/algorithmiq.json`** — dismissed 2026-09-02 (PR #92) — entry already states Finnish founding and the May 2026 Milan move; `country` correctly reflects current HQ
      - Country field lists Italy, but fetched sources confirm Algorithmiq was founded in Helsinki, Finland in 2020 and relocated to Milan only in May 2026.
- [x] **`companies/beit.json`** — dismissed 2026-09-02 (PR #92) — The Quantum Insider directly confirms 2016; R&D World only paraphrases what "BEIT says"
      - Founded date conflict: entry states 2016, The Quantum Insider (2019-11-28) confirms 2016, but R&D World (2026-04-30) states 'where BEIT says it was founded in 2017'
- [x] **`companies/bosch-quantum-sensing.json`** — resolved 2026-09-02 (PR #92) — in-house startup Feb 2022, JV from 2025
      - Entry founded date is 2023; sources (The Quantum Insider, LinkedIn) state the in-house startup was founded in 2022.
- [x] **`companies/cryptomathic.json`** — dismissed 2026-09-02 (PR #92) — Global Security Mag states "Founded in 1986" explicitly; the IQT figure is arithmetic from a rounded "37 years ago"
      - Founding year: Global Security Mag (2021) states 'Founded in 1986' but Inside Quantum Technology (2022) states 'founded 37 years ago' (implying ~1985)
- [ ] **`companies/diasense.json`** — **BLOCKED 2026-09-02** — cannot verify: the cited Quantum Insider article returns HTTP 404, so the EUR 1.8M/1.9M and Lyngby/Copenhagen conflicts have no live source to arbitrate. Needs a replacement source
      - Total BII funding after March 2026 round: entry states €1.8M but TheQuantumInsider states €1.9M as total BII investment
      - Location: entry describes as 'Lyngby-based' but multiple sources (TheQuantumInsider, QuantumComputingReport) describe as 'Copenhagen-based'
- [ ] **`companies/hqs.json`**
      - Entry describes company as developing 'quantum simulation software for materials science and chemistry applications' and 'materials discovery,' but all sources state HQS develops spectroscopy software (NMR, UV/Vis, IR, relaxometry) for diagnostic and analytical purposes in life sciences, chemistry, and pharma—fundamentally different applications.
- [x] **`companies/isentroniq.json`** — resolved 2026-09-02 (PR #94) — reworded to co-founder
      - Entry states 'Founded by Paul Magnard' but Quantum Computing Report identifies him as 'co-founder and CEO', indicating multiple founders
- [ ] **`companies/multiverse-computing.json`**
      - Entry states Singularity is the flagship product that 'enables model compression', but all fetched sources identify CompactifAI as the model compression platform (Wikipedia explicitly: 'The AI model compression platform, CompactifAI'), with Singularity listed as a separate product without compression attribution.
- [ ] **`companies/nkt-photonics.json`**
      - Entry name is 'NKT Photonics' but fetched sources confirm the company was renamed to 'Hamamatsu Photonics A/S' on June 25, 2026, and now operates as the Lasers & Fibers Business Unit of Hamamatsu Photonics Group.
- [x] **`companies/nvision-imaging.json`** — resolved 2026-09-02 (PR #94) — nvision-imaging.com 301-redirects to nvision-quantum.com; copyright reads "2026 NVision Quantum"
      - Entry name is 'NVision Imaging Technologies' but all fetched sources refer to 'NVision' or 'NVision Quantum' (website copyright: '© 2026 NVision Quantum')
- [x] **`companies/orange-quantum-systems.json`** — dismissed 2026-09-02 (PR #92) — sole counter-source is LinkedIn, excluded by CLAUDE.md
      - Founded year: entry states 2019, but LinkedIn profile states 'Opgericht 2020' (Founded 2020)
- [x] **`companies/parityqc.json`** — dismissed 2026-09-02 (PR #94) — "the quantum architecture company" is self-description, not a schema category. The type enum is hardware|software|cloud|consulting|research|hybrid|other, and ParityOS is software
      - Entry Type is 'software', but all sources (parityqc.com, HPCwire, The Quantum Insider) explicitly identify ParityQC as 'the quantum architecture company'
- [x] **`companies/phasecraft.json`** — resolved 2026-09-02 (PR #92) — founded 2019 per University of Bristol
      - Entry states 'Founded: 2018' but uktech.news source explicitly states 'Founded in 2019'
- [x] **`companies/q-ant.json`** — resolved 2026-09-02 (PR #94) — confirmed: www.q-ant.com is an unrelated football-analytics platform. Q.ANT is qant.com; website and sources corrected, funding updated to the EUR 62M Series A (July 2025)
      - Critical sourcing error: www.q-ant.com currently hosts a football data management platform unrelated to quantum computing, not Q.ANT's quantum technology content. Entry field validation via this source is unreliable.
- [x] **`companies/qblox.json`** — dismissed 2026-09-02 (PR #92) — sole counter-source is LinkedIn, excluded by CLAUDE.md; the EIC institutional page states no year
      - Entry states Founded: 2019, but LinkedIn company page states Founded: 2018
- [x] **`companies/qmill.json`** — dismissed 2026-09-02 (PR #94) — "quantum algorithm and software company" maps to software in the schema enum; no separate algorithms category exists
      - Entry type is 'software' but fetched sources explicitly describe QMill as 'quantum algorithm and software company' — type should be 'algorithms & software' or similar, not software alone.
- [x] **`companies/qphox.json`** — resolved 2026-09-02 (PR #92) — founded 2021 per qphox.eu
      - Entry founded year is 2020, but QphoX website states 'QphoX was established in 2021'
- [x] **`companies/qubit-pharmaceuticals.json`** — resolved 2026-09-02 (PR #92) — founded 2021 per own site
      - Entry states founded 2020; website states 'our inception in 2021' for the company
- [x] **`companies/qunorth.json`** — resolved 2026-09-02 (PR #94) — qunorth.com: Magne "expected to be fully operational in early 2027"
      - Entry states Magne operational 'late 2026'; qunorth.com states 'early 2027'
- [x] **`companies/rotonium.json`** — dismissed 2026-09-02 (PR #94) — the entry follows The Quantum Insider (qudit), the more credible of the two conflicting sources; startupbusiness.it is the weaker
      - The Quantum Insider refers to 'single-photon qudit technology' while startupbusiness.it refers to 'single-photon qubit' — sources conflict on core technology terminology.
- [x] **`companies/scalinq.json`** — resolved 2026-09-02 (PR #94) — scalinq.com: "LINQER is a patent-granted solution"
      - Entry states LINQER is 'patent-pending' but fetched source states it is 'patent-granted'
- [x] **`companies/siphotonic.json`** — resolved 2026-09-02 (PR #94) — siphotonic.com: 1-3 months prototyping, 3-4 months MPW
      - Entry states turnaround of '1.5-3.5 months' but fetched sources consistently state '1–3 months' for on-demand prototyping runs and '3–4 months' for MPW runs
- [x] **`companies/sparrow-quantum.json`** — dismissed 2026-09-02 (PR #94) — the sources conflict with each other, labelling both the April 2025 EUR 21.5M and December 2025 EUR 27.5M rounds "Series A". The entry's neutral "follow-on round" is contradicted by neither
      - Entry describes December 2025 €27.5M round as a 'follow-on round,' but The Quantum Insider article (Dec 1, 2025) explicitly labels it 'Series A funding'—conflicting with April 2025 article also calling the €21.5M round 'Series A'.
- [x] **`companies/terra-quantum.json`** — dismissed 2026-09-02 (PR #94) — country is single-valued in the schema and Terra Quantum is headquartered in Switzerland; German operations do not change the HQ
      - Entry lists Country: Switzerland, but PKI Consortium source states Terra Quantum is 'based in Germany and Switzerland'
- [x] **`companies/veriqloud.json`** — resolved 2026-09-02 (PR #94) — type software -> hybrid; Qline is quantum communication hardware
      - Entry type is 'software' but Quantonation source explicitly states Qline is 'quantum communication hardware' and describes VeriQloud as developing both hardware and software solutions.
- [ ] **`companies/xeedq.json`** — **BLOCKED 2026-09-02** — cannot verify: the cited xeedq.com DLR announcement returns HTTP 404. The 256-qubit target year cannot be checked against it
      - Entry states '256+ qubit mobile processors by 2028'; DLR award announcement (Dec 2022) states 'goal to reach 256 qubits or more by 2026'
- [x] **`companies/zuriq.json`** — resolved 2026-09-02 (PR #94) — zuriq.com: "natively three-dimensional"; the 2D array is one part of it
      - Entry describes ions moving 'freely in two dimensions'; sources state ions move 'in all spatial directions' and describe 'natively three-dimensional' architecture.
- [ ] **`resources/bmbf-quantum-technologies.json`**
      - Entry states programme funding exceeds €2 billion; Fraunhofer IOF source (2021) states 1.1 billion euros for the quantum technology funding package
- [ ] **`resources/cern-qti-lectures.json`**
      - Entry states series began March 2023; Inside Quantum Technology (2020-11-06) reports CERN QTI lectures started November 6, 2020
- [ ] **`resources/eic-accelerator.json`**
      - Entry claims investments 'ranging from €2.5 million to €17.5 million', but official EIC source states maximum equity investment is €10 million, not €17.5 million.
- [ ] **`resources/ibm-quantum-learning.json`**
      - Entry type field says 'course' but fetched sources describe IBM Quantum Learning as a 'comprehensive educational platform' and 'library of 10+ courses' — a platform with multiple courses, not a single course.
- [ ] **`resources/netqasm.json`**
      - Entry mentions simulator backend 'SquidASM' but arXiv paper (2111.09823) states 'Our SDK can be used at home by making use of our existing quantum simulators, NetSquid and SimulaQron' — source names NetSquid, not SquidASM
- [ ] **`resources/quantum-delta-nl.json`**
      - Entry states €615 million from National Growth Fund; EC source states EUR 264 million from Recovery and Resilience Fund
- [ ] **`resources/unitary-fund.json`**
      - Entry name is 'Unitary Fund' but official website (https://unitary.foundation/) identifies the organization as 'Unitary Foundation'.
- [ ] **`resources/wacqt.json`**
      - Budget discrepancy: entry states SEK 1.4 billion, but Chalmers website states SEK 1 billion (Wallenberg Foundation source confirms 1.4 billion during 2018–2030).
- [ ] **`resources/xanadu-codebook.json`**
      - Entry name 'Xanadu Quantum Codebook' conflicts with GitHub repo statement that the resource is 'now known as the PennyLane Codebook' — current branding is PennyLane Codebook, not Xanadu Quantum Codebook

## B. Consolidation conflicts (5)

Successive weekly sweeps each rewrote these fields from a stale baseline, so the
merge in PR #85 kept the *last authored* value — not always the *best sourced* one.
Superseded values remain intact in the source branches.

| Entry | Field | Kept | Superseded |
|---|---|---|---|
| `companies/iqm.json` | funding + highlights | `Public (Nasdaq: IQMX, July 2026); EUR 309.4M cash post-listing` (#83) | oscillated across #69/#75/#79/#81 — incl. `EUR 337M+ cash post-listing` |
| `companies/multiverse-computing.json` | funding | `USD 285M+` (#79, 2026-08-16) | `USD 570M Series C (July 2026, $1.7B pre-money); total ~USD 800M` (#75, 2026-08-02) |
| `companies/oqc.json` | funding | `GBP 260M (USD 350M) Series C` (#81) | `USD 500M+ (GBP 260M Series C, June 2026)` (#69) |
| `companies/pasqal.json` | funding + highlights | `Public (Nasdaq: PSQL, August 2026); USD 360M cash at IPO close` (#83) | `EUR 340M+` |
| `companies/quantum-motion.json` | funding | `GBP 182M+` (#77) | `GBP 180M+ (incl. USD 160M Series C, 2026)` (#49) |

- [ ] `companies/iqm.json`
- [ ] `companies/multiverse-computing.json`
- [ ] `companies/oqc.json`
- [ ] `companies/pasqal.json`
- [ ] `companies/quantum-motion.json`

## Provenance

Section A is derived from the sweep run report (`data/generated/sweep-runs.json`),
which is gitignored and overwritten on every run — this file is the durable copy.
After a future sweep, regenerate A from the new report rather than editing it by
hand, and carry any unticked boxes forward.
