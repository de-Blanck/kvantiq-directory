# Weekly Autonomous Agent — Design Spec

**Date:** 2026-03-21
**Status:** Draft
**Author:** Claude + Rune

## Overview

An autonomous Claude agent that runs every Sunday via GitHub Actions, maintaining and enriching the Kvantiq European Quantum Computing Directory. The agent operates two independent tracking systems: directory QA/QC (operational health) and industry intelligence (ecosystem events over time).

## Goals

1. Discover and add every legitimate quantum company in EU + UK + Iceland
2. Track the global quantum ecosystem for context (silently — not added to directory unless EU/UK/Iceland)
3. Enforce a strict 14-day activity verification window on all directory entries
4. Build a structured industry intelligence timeline (funding, acquisitions, closures, breakthroughs)
5. Store all data in a queryable SQLite database enabling charts, timelines, and BI
6. Notify via ClickUp tasks (items needing human judgment) and Resend email (weekly digest)
7. All changes delivered as PRs for human review before merging

## Architecture

```
GitHub Actions (cron: Sundays ~08:17 UTC)
│
├── Checkout repo
├── Install dependencies
├── Run: npx tsx scripts/weekly-agent.ts
│
│   ┌──────────────────────────────────────────────┐
│   │  Claude Agent SDK (TypeScript)               │
│   │                                               │
│   │  Built-in tools:                              │
│   │    WebSearch, WebFetch, Read, Write, Edit,    │
│   │    Glob, Grep, Bash                           │
│   │                                               │
│   │  Custom MCP tools:                            │
│   │    clickup — create task, tag user             │
│   │    resend  — send weekly digest email          │
│   │                                               │
│   │  Agent phases:                                │
│   │    1. Research — scan curated sources          │
│   │    2. Audit — validate existing entries        │
│   │    3. Act — edit files, update DB, branch, PR │
│   │    4. Report — ClickUp tasks + email digest   │
│   └──────────────────────────────────────────────┘
│
└── Agent opens PR via gh pr create
```

### Model

Claude Sonnet 4.6 — sufficient for structured research and validation tasks, cost-effective for weekly automated runs.

### Runtime

GitHub Actions free tier (2,000 min/month for private repos). Expected usage: ~30 min/week.

## Curated Source List

### National Quantum Initiatives (all EU + UK + Iceland)

- **Denmark:** Danish Quantum Community (DQC), DTU quantum research, DQC country partners
- **Sweden:** Wallenberg Centre for Quantum Technology (WACQT), Chalmers
- **Norway:** SINTEF quantum, QuNorth
- **Finland:** VTT quantum, IQM (HQ)
- **Germany:** Munich Quantum Valley, Fraunhofer IQS, DLR quantum computing
- **Austria:** AIT quantum, University of Innsbruck
- **Switzerland:** ETH Zürich quantum, EPFL
- **Netherlands:** QuTech, TNO quantum
- **France:** Alice & Bob, Pasqal, Quandela
- **Ireland, Spain, Italy, Portugal, Poland, Czech Republic, Estonia, etc.:** National research centers and quantum startups
- **UK:** National Quantum Computing Centre, Quantinuum, Oxford Quantum Circuits
- **Iceland:** Emerging quantum research programs

### Ecosystem Organizations

- DQC country partners network
- QuNorth (Nordic quantum network)
- 55 North
- Magne
- QBusiness

### EU-Level Programs

- EU Quantum Flagship projects and consortium updates
- EuroQCI (European Quantum Communication Infrastructure)
- European Innovation Council quantum grants

### Industry / Frontier Sources

- Quantum Computing Report (QCR) — company tracker
- The Quantum Insider — news and company database
- GitHub trending repos tagged quantum computing
- arXiv quant-ph (filtering for European-affiliated institutions)

### Global Silent Tracking

- Major quantum companies worldwide (IBM, Google, IonQ, Rigetti, etc.) tracked for context, acquisitions, partnerships affecting EU ecosystem
- Not added to directory unless EU/UK/Iceland presence

The source list is stored in `data/sources.json` and editable without code changes.

## Entry Quality Gate

Before adding any new entry, Claude must verify ALL of the following:

### 1. Company Is Real
- Live website with valid SSL
- Identifiable team/founders
- Registered business entity (where verifiable)

### 2. Actually Quantum
- Core business involves quantum computing, sensing, communication, or enabling technology
- Not just "AI" or "deep tech" with quantum in the marketing copy

### 3. Active (14-Day Rule)
At least 1 primary signal verifiable within the last 14 days:
- Git commit on public repos
- Blog post / news article / press release
- Social media post (LinkedIn company page, X/Twitter)
- Active job posting (posted or refreshed within 14 days)
- Conference talk / event participation
- Funding announcement / regulatory filing

### 4. Categorizable
- Fits into an existing directory category (company, resource, benchmark, use case, challenge)
- If no existing category fits: Claude proposes a new category with an argument, creates a ClickUp task, and **waits for explicit human approval** before creating it

## Confidence Scoring

Every entry receives a confidence score on every weekly audit:

| Score | Criteria | Action |
|-------|----------|--------|
| `HIGH` | 2+ primary signals within 14 days | No action needed |
| `MEDIUM` | 1 primary signal within 14 days | Monitor closely |
| `LOW` | No primary signal within 14 days | Flagged for review |
| `DEAD` | Website down + no signals for 30+ days | Flagged for removal |

## Staleness Detection

For existing entries, Claude checks weekly:

- **Dead links** — HTTP HEAD returns 4xx/5xx or timeout → auto-fix if new URL found, otherwise flag
- **Company shut down** — website gone + news of closure → flag for removal, record closure event
- **Acquired** — company acquired → update entry with acquirer info, record acquisition event
- **Outdated benchmarks** — newer data available → update
- **Stale metadata** — description no longer matches what the company does → update
- **Activity lapse** — no 14-day signal found → downgrade confidence, flag if LOW

## Content Model Mapping

The directory has 5 distinct content collections, each with its own Zod schema (defined in `src/content.config.ts`). The agent must map between the database and these polymorphic schemas:

| Collection | Directory Path | Key Fields | Agent Scope |
|---|---|---|---|
| `companies` | `src/content/companies/*.json` | name, slug, country, region, type, tags, description, website, sources | Primary focus — discover, validate, update |
| `benchmarks` | `src/content/benchmarks/*.json` | name, slug, algorithm, category, tags, description, sources | Monitor for updates |
| `use-cases` | `src/content/use-cases/*.json` | name, slug, industry, category, tags, description, sources | Monitor for updates |
| `challenges` | `src/content/challenges/*.json` | name, slug, organizer, tags, description, website, sources | Monitor for updates |
| `resources` | `src/content/resources/*.json` | name, slug, type, tags, description, website, sources | Monitor for updates |

### Enum Mappings

**Company `type` (Astro schema):** `hardware | software | cloud | consulting | research | hybrid | other`
**Company `region` (Astro schema):** `nordics | dach | western-europe | southern-europe | eastern-europe | uk`

The database `companies.sector` field maps to the Astro `type` enum. The agent uses the Astro enum as canonical and stores the same values in the database.

### Adding New Entries

When the agent creates a new company JSON file, it must:

1. Generate a slug from the company name (lowercase, hyphenated, matching filename)
2. Determine the `region` from the country
3. Assign a `type` from the Astro enum
4. Write a factual 2-3 sentence description (no marketing language)
5. Include minimum 1 verified source (Zod enforces `.min(1)`, but CLAUDE.md maintenance rules require 2+ — agent must provide 2+)
6. Each source needs: `type` (`doi | arxiv | url | website | press-release`), `url`, and optional `title`, `authors`, `datePublished`, `dateAccessed`

### Country-to-Region Mapping

```
nordics: Denmark, Sweden, Norway, Finland, Iceland
dach: Germany, Austria, Switzerland
western-europe: France, Netherlands, Belgium, Luxembourg, Ireland
southern-europe: Spain, Portugal, Italy, Greece, Malta, Cyprus
eastern-europe: Poland, Czech Republic, Estonia, Latvia, Lithuania, Hungary, Romania, Bulgaria, Slovakia, Slovenia, Croatia
uk: United Kingdom
```

## Database Schema

SQLite database at `data/kvantiq.db`. Two independent tracking layers sharing a `companies` bridge table.

### Layer 1: Directory QA/QC (Operational)

```sql
CREATE TABLE entries (
    id TEXT PRIMARY KEY,          -- UUID
    name TEXT NOT NULL,
    collection TEXT NOT NULL,     -- companies | benchmarks | use-cases | challenges | resources
    subcategory TEXT,             -- type/category within collection (e.g., 'hardware', 'optimization')
    slug TEXT NOT NULL,           -- matches filename and JSON slug field
    url TEXT,
    country TEXT,
    date_added TEXT NOT NULL,     -- ISO 8601
    date_last_verified TEXT,
    status TEXT NOT NULL DEFAULT 'active',  -- active | flagged | removed
    current_confidence TEXT NOT NULL DEFAULT 'HIGH'  -- HIGH | MEDIUM | LOW | DEAD
);

CREATE TABLE audits (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL REFERENCES entries(id),
    audit_date TEXT NOT NULL,
    confidence_score TEXT NOT NULL,
    signals_found TEXT NOT NULL,    -- JSON array
    signals_checked TEXT NOT NULL,  -- JSON array
    action_taken TEXT NOT NULL,     -- none | updated | flagged | removed | added
    details TEXT,
    pr_number INTEGER
);

CREATE TABLE category_proposals (
    id TEXT PRIMARY KEY,
    proposed_name TEXT NOT NULL,
    argument TEXT NOT NULL,
    proposed_entries TEXT NOT NULL,  -- JSON array
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    date_proposed TEXT NOT NULL,
    date_resolved TEXT
);

CREATE TABLE sources_checked (
    id TEXT PRIMARY KEY,
    audit_date TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    entries_found INTEGER NOT NULL DEFAULT 0,
    new_entries_discovered INTEGER NOT NULL DEFAULT 0
);
```

### Layer 2: Industry Intelligence (Strategic)

```sql
CREATE TABLE companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    entry_id TEXT REFERENCES entries(id),  -- nullable: not all tracked companies are in the directory
    country TEXT,
    founded_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',  -- active | acquired | shut_down | merged
    sector TEXT,  -- uses Astro company type enum: hardware | software | cloud | consulting | research | hybrid | other
    date_first_tracked TEXT NOT NULL
);

CREATE TABLE events (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id),
    event_date TEXT NOT NULL,
    event_type TEXT NOT NULL,  -- founded | funding | acquisition | closure | merger | ipo | partnership | breakthrough | product_launch | grant_awarded | milestone | pivot | expansion
    headline TEXT NOT NULL,
    details TEXT,
    amount_eur REAL,           -- normalized to EUR for funding/acquisition amounts
    source_url TEXT,
    confidence TEXT NOT NULL DEFAULT 'verified',  -- verified | probable | unconfirmed
    date_recorded TEXT NOT NULL
);

CREATE TABLE market_snapshots (
    id TEXT PRIMARY KEY,
    snapshot_date TEXT NOT NULL,
    total_companies_tracked INTEGER NOT NULL,
    total_active INTEGER NOT NULL,
    total_funding_eur_ytd REAL,
    new_companies_ytd INTEGER,
    closures_ytd INTEGER,
    acquisitions_ytd INTEGER,
    top_event_summary TEXT,
    countries_represented INTEGER
);
```

### Trackable Metrics

**Directory QA/QC:**
- Confidence distribution over time (is the directory getting healthier?)
- Discovery rate — new entries per week, by country, by category
- Churn — entries flagged/removed over time
- Source effectiveness — which sources yield the most discoveries
- Coverage maps — entries by country, gaps in coverage

**Industry Intelligence:**
- Funding timeline — total capital by quarter, country, sector
- Company lifecycle — founded → funded → scaling → acquired/IPO
- Ecosystem health — birth rate vs death rate of quantum companies
- Country heatmaps — where is quantum money flowing?
- Breakthrough timeline — major technical milestones chronologically
- Sector trends — hardware vs software vs sensing growth
- Acquisition graph — who's buying whom

## Sources Schema

`data/sources.json` structure:

```json
{
  "sources": [
    {
      "name": "Danish Quantum Community",
      "url": "https://danishquantumcommunity.com",
      "type": "organization",
      "strategy": "web_fetch",
      "geographic_scope": ["DK"],
      "notes": "Check members page and news section"
    },
    {
      "name": "Quantum Computing Report",
      "url": "https://quantumcomputingreport.com",
      "type": "industry_tracker",
      "strategy": "web_search",
      "geographic_scope": ["global"],
      "notes": "Search for 'new company' and 'funding' within last 14 days"
    },
    {
      "name": "arXiv quant-ph",
      "url": "https://arxiv.org/list/quant-ph/recent",
      "type": "academic",
      "strategy": "web_search",
      "geographic_scope": ["global"],
      "notes": "Filter for European-affiliated institutions"
    }
  ]
}
```

Source `type`: `organization | national_initiative | industry_tracker | academic | news | ecosystem_network | funding_database`

Source `strategy`:
- `web_fetch` — fetch the URL directly and extract structured data from the page
- `web_search` — use WebSearch with targeted queries derived from the source context
- `both` — fetch the page for overview, then search for specific updates

## Research Strategy by Source Type

| Source Type | Strategy | Example Query |
|---|---|---|
| Organization/network | `web_fetch` their members/partners page | Fetch DQC partners page, extract company list |
| Industry tracker | `web_search` for recent entries | `site:quantumcomputingreport.com new company 2026` |
| Academic | `web_search` for European quantum papers | `arxiv quant-ph European institution 2026 March` |
| News | `web_search` with date filter | `quantum computing Europe funding OR acquisition past 14 days` |
| National initiative | `web_fetch` their projects/members page | Fetch Munich Quantum Valley members page |
| Funding database | `web_search` for recent grants | `EU quantum flagship grant awarded 2026` |

## Human Judgment Thresholds

The agent auto-handles vs. flags to ClickUp based on these rules:

| Situation | Agent Action | Why |
|---|---|---|
| Dead link + new URL found via redirect | Auto-fix | Low risk, verifiable |
| Dead link + no redirect, company still active | Auto-fix URL if found via search | Verifiable |
| Dead link + no URL found + no activity signals | Flag for removal | Permanent deletion needs human approval |
| Company acquired | Update entry + record event, flag for review | Acquisition may change directory relevance |
| Company shut down (confirmed) | Flag for removal | Permanent deletion needs human approval |
| New company passes all quality gates | Auto-add via PR | Human reviews via PR approval |
| New company passes most gates but borderline (1 signal, uncertain quantum relevance) | Flag as ClickUp task with evidence | Borderline calls need human judgment |
| New category needed | Flag with argument + proposed entries | Human must approve structural changes |
| Benchmark/use-case outdated | Auto-update if new data is clear, flag if ambiguous | Data accuracy needs confidence |
| Entry description drift | Auto-update if factual change is clear | PR review catches errors |

## Failure Modes & Error Handling

| Failure | Response |
|---|---|
| **Web search rate limited** | Back off exponentially. If persistent, complete audit with available data, note skipped entries in PR description |
| **GitHub Actions timeout (>30 min)** | Agent has a soft timeout at 25 min. At 25 min, stop research, commit whatever is done, open PR noting "partial run — X entries not audited" |
| **ClickUp API down** | Log tasks to a `data/pending-clickup-tasks.json` file, commit to PR. Next week's run picks them up |
| **Resend API down** | Log email content to `data/pending-email.json`, commit to PR. Agent tries to send on next run |
| **Previous weekly PR still open** | Do NOT create a new PR. Instead, push new commits to the existing `weekly/YYYY-MM-DD` branch and comment on the PR |
| **SQLite corruption** | Agent detects via integrity check at start. If corrupt, rebuild from JSON content files (source of truth) and log the rebuild |
| **50+ new companies in one run** | Cap PR at 20 new entries per run. Remaining discoveries are queued in `data/discovery-queue.json` for next week |
| **Branch already exists** | Append `-v2`, `-v3` suffix to branch name |

## Migration Plan (Existing 183 Entries)

A one-time migration script (`scripts/migrate-to-db.ts`) runs before the first weekly agent execution:

1. Read all JSON files from `src/content/{companies,benchmarks,use-cases,challenges,resources}/`
2. For each file:
   - Insert into `entries` table (collection, slug, name, country, url, status=active, confidence=MEDIUM)
   - For companies: also insert into `companies` table (sector from type field, founded from founded field)
3. Set `date_added` to the file's git creation date (via `git log --follow --format=%aI --diff-filter=A -- <file>`)
4. Set `current_confidence` to `MEDIUM` for all (they haven't been audited yet — first weekly run will establish baselines)
5. Create one `audits` row per entry with action_taken=`migrated`

This script is idempotent — safe to re-run.

## Concrete Limits

```typescript
const AGENT_OPTIONS = {
  model: "claude-sonnet-4-6",
  maxTurns: 200,           // ~200 tool calls should cover 500 entries with tiered checks
  maxBudgetUsd: 10.0,      // hard stop at $10 per run (well above expected $4-8)
  permissionMode: "bypassPermissions",  // fully autonomous, no human prompts
};
```

**Token estimate at 500 entries:**
- System prompt + QA/QC rules: ~5K input tokens
- Reading existing entries from DB: ~20K input tokens
- Web searches (~250 searches at tiered rate): ~250K input tokens (results)
- File edits + git operations: ~10K output tokens
- Agent reasoning: ~50K output tokens
- **Total per run:** ~275K input + ~60K output
- **Cost:** ~275K × $3/1M + ~60K × $15/1M = $0.83 + $0.90 = ~$1.73/run → **$7/month**
- At scale with more discoveries and events: **$15-30/month**

## Agent Flow (Weekly)

```
1. RESEARCH PHASE
   ├── Load curated sources from data/sources.json
   ├── Load QA/QC rules from scripts/prompts/system-prompt.md
   ├── Search each source for new companies and events
   ├── Filter: EU + UK + Iceland → directory candidates
   ├── Filter: global → silent tracking only (intelligence DB)
   └── Collect industry events (funding, acquisitions, milestones)

2. AUDIT PHASE
   ├── For each existing directory entry:
   │   ├── HTTP HEAD check on all URLs (via curl — zero token cost)
   │   ├── Web search for 14-day activity signals
   │   ├── Score confidence (HIGH / MEDIUM / LOW / DEAD)
   │   └── Record audit in audits table
   ├── Detect status changes (acquisitions, closures) → events table
   └── Tiered validation to control costs:
       ├── HIGH from last week → light check (link + 1 search)
       └── MEDIUM/LOW/new → deep check (multiple signals)

3. ACT PHASE
   ├── New entries passing quality gate:
   │   ├── Map to collection + subcategory (company type, benchmark category, etc.)
   │   ├── If no existing category fits → create category_proposal + ClickUp task, skip entry
   │   ├── Generate JSON file matching Astro Zod schema (2+ sources, factual description)
   │   └── Add to directory files
   ├── Stale entries → update or flag
   ├── Update both database layers
   ├── Create git branch: weekly/YYYY-MM-DD
   ├── Commit all changes
   ├── Open PR via gh pr create
   └── Items needing human judgment → ClickUp tasks

4. REPORT PHASE
   ├── Add market_snapshots row
   ├── Send weekly digest email via Resend
   │   ├── Directory updates (new, flagged, removed)
   │   ├── Industry intelligence (funding, acquisitions, milestones)
   │   └── Items needing attention (ClickUp links)
   └── Log sources_checked for effectiveness tracking
```

## Cost Optimization

- **Sonnet 4.6** for all automated runs (not Opus)
- **Tiered validation** — HIGH confidence entries get light checks, saving ~50% of web searches
- **Batch HTTP checks** — dead link detection via `curl -I` costs zero tokens
- **DB caching** — last week's signals stored, agent skips re-researching confirmed active entries
- **Estimated cost:** $15-30/month at 500 entries, scaling linearly with entry count

## Integrations

### Resend (Email)
- **From:** notifications@kvantiq.studio (or similar, verified domain)
- **To:** hi@kvantiq.studio
- **Frequency:** Weekly, after PR is created
- **Free tier:** 3,000 emails/month, 100/day

### ClickUp
- **API token** stored as GitHub Actions secret
- **Triggers:** new category proposals, borderline entries, entries needing human judgment, removal confirmations
- **Tags user** in task for visibility

### GitHub
- **Branch pattern:** `weekly/YYYY-MM-DD`
- **PR format:** structured summary with directory changes + intelligence highlights
- **GITHUB_TOKEN** from Actions (automatic)

## File Structure (New Files)

```
kvantiq-directory/
├── scripts/
│   ├── weekly-agent.ts              # Agent SDK entry point
│   ├── tools/
│   │   ├── clickup.ts               # ClickUp custom MCP tool
│   │   └── resend.ts                # Resend email custom MCP tool
│   └── prompts/
│       └── system-prompt.md         # QA/QC rules, source list, scoring — loaded verbatim
├── data/
│   ├── kvantiq.db                   # SQLite database (both layers)
│   └── sources.json                 # Curated source list (editable without code changes)
```

## Security

- All API keys stored as GitHub Actions secrets (never in code)
- Agent runs with `permissionMode: "bypassPermissions"` — fully autonomous (no human present to prompt)
- `maxTurns: 200` and `maxBudgetUsd: 10.0` prevent runaway execution
- Agent cannot push to main — only creates PRs for human review

## Email Digest Format

```
Subject: Kvantiq Weekly — 2026-03-23 | 3 new companies, 7 events tracked

DIRECTORY UPDATES
─────────────────
New entries:
  🇩🇰 QuantumDK — quantum sensing startup (Copenhagen)
  🇩🇪 QBridge GmbH — quantum networking (Munich)
  🇫🇮 FrostQubit — cryogenic controllers (Espoo)

Flagged for review:
  ⚠️ NordicQ — no activity signal in 14 days (was MEDIUM)

Removed: none

INDUSTRY INTELLIGENCE
─────────────────────
💰 IQM raised €150M Series C (lead: EQT Ventures)
🤝 Quantinuum acquired Oxford Ionics
🚀 Pasqal hit 1000-qubit neutral atom milestone
📋 EU Quantum Flagship Phase 3 grants announced

NEEDS YOUR ATTENTION
────────────────────
• New category proposal: "Quantum Education" — 4 entries don't fit existing categories
  → [ClickUp task link]
• NordicQ activity lapse — verify manually or approve removal
  → [ClickUp task link]

PR: https://github.com/de-Blanck/kvantiq-directory/pull/XX
```

## Open Questions (Pre-Implementation)

1. **ClickUp workspace/space/list** — needs to be set up; agent needs the list ID for task creation. Rune to create workspace and provide list ID.
2. **Resend domain verification** — kvantiq.studio needs DNS records (SPF, DKIM) added in Cloudflare for sending. Rune to verify domain in Resend dashboard.
3. **Global tracking scope** — initial scope: top 50 global quantum companies by funding/market cap. Expand organically as the agent discovers relevant players through acquisitions and partnerships affecting EU ecosystem.
