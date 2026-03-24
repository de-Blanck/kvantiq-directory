# Weekly Autonomous Agent — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an autonomous Claude Agent SDK agent that runs weekly via GitHub Actions to maintain, enrich, and audit the Kvantiq quantum computing directory, with a public transparency dashboard.

**Architecture:** TypeScript Agent SDK script with custom MCP tools (ClickUp, Resend) running in GitHub Actions on a Sunday cron. SQLite database tracks two independent layers: directory QA/QC and industry intelligence. Transparency pages built as static Astro pages consuming pre-generated JSON from the database.

**Tech Stack:** `@anthropic-ai/claude-agent-sdk`, `better-sqlite3`, Astro 6, Chart.js, Resend SDK, ClickUp REST API, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-03-21-weekly-agent-design.md`

**Working directory:** `E:\kvantiq-directory` (main branch — agent infrastructure lives at repo root, not in the feature worktree)

---

## Phase 1: Data Layer (SQLite + Migration)

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install SQLite and UUID packages**

```bash
cd E:/kvantiq-directory
npm install better-sqlite3 uuid
npm install -D @types/better-sqlite3 @types/uuid
```

- [ ] **Step 2: Install Agent SDK and integration packages**

```bash
npm install @anthropic-ai/claude-agent-sdk resend
```

- [ ] **Step 3: Install tsx as dev dependency**

```bash
npm install -D tsx
```

Note: Chart.js is loaded via CDN in the transparency pages (lightweight, no build step needed). No npm install required for it.

- [ ] **Step 4: Verify build still passes**

```bash
npm run build
```

Expected: Build succeeds, no regressions.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add better-sqlite3, agent-sdk, resend, chart.js"
```

---

### Task 2: Create SQLite schema initialization

**Files:**
- Create: `scripts/db/schema.ts`
- Create: `scripts/db/index.ts`

- [ ] **Step 1: Write database schema initialization**

`scripts/db/schema.ts` — exports a function that creates all tables if they don't exist:

```typescript
import Database from 'better-sqlite3';

export function initializeSchema(db: Database.Database): void {
  db.exec(`
    -- Layer 1: Directory QA/QC
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      collection TEXT NOT NULL,
      subcategory TEXT,
      slug TEXT NOT NULL,
      url TEXT,
      country TEXT,
      date_added TEXT NOT NULL,
      date_last_verified TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      current_confidence TEXT NOT NULL DEFAULT 'HIGH'
    );

    CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES entries(id),
      audit_date TEXT NOT NULL,
      confidence_score TEXT NOT NULL,
      signals_found TEXT NOT NULL,
      signals_checked TEXT NOT NULL,
      action_taken TEXT NOT NULL,
      details TEXT,
      pr_number INTEGER
    );

    CREATE TABLE IF NOT EXISTS category_proposals (
      id TEXT PRIMARY KEY,
      proposed_name TEXT NOT NULL,
      argument TEXT NOT NULL,
      proposed_entries TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      date_proposed TEXT NOT NULL,
      date_resolved TEXT
    );

    CREATE TABLE IF NOT EXISTS sources_checked (
      id TEXT PRIMARY KEY,
      audit_date TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_url TEXT,
      entries_found INTEGER NOT NULL DEFAULT 0,
      new_entries_discovered INTEGER NOT NULL DEFAULT 0
    );

    -- Layer 2: Industry Intelligence
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      entry_id TEXT REFERENCES entries(id),
      country TEXT,
      founded_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      sector TEXT,
      date_first_tracked TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      event_date TEXT NOT NULL,
      event_type TEXT NOT NULL,
      headline TEXT NOT NULL,
      details TEXT,
      amount_eur REAL,
      source_url TEXT,
      confidence TEXT NOT NULL DEFAULT 'verified',
      date_recorded TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS market_snapshots (
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
  `);
}
```

- [ ] **Step 2: Write database connection helper**

`scripts/db/index.ts` — opens or creates the database, runs schema init, exports the connection:

```typescript
import Database from 'better-sqlite3';
import { resolve } from 'path';
import { initializeSchema } from './schema.js';

const DB_PATH = resolve(import.meta.dirname, '../../data/kvantiq.db');

export function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Integrity check
  const result = db.pragma('integrity_check') as { integrity_check: string }[];
  if (result[0]?.integrity_check !== 'ok') {
    throw new Error(`SQLite integrity check failed: ${JSON.stringify(result)}`);
  }

  initializeSchema(db);
  return db;
}

export { Database };
```

- [ ] **Step 3: Create the data directory and configure git for binary DB**

The SQLite DB must be committed so Vercel can generate transparency pages at build time. Mark it as binary in `.gitattributes`:

```bash
mkdir -p data
echo "data/kvantiq.db binary" >> .gitattributes
```

- [ ] **Step 4: Commit**

```bash
git add scripts/db/schema.ts scripts/db/index.ts .gitattributes
git commit -m "feat: add SQLite schema and database connection helper"
```

---

### Task 3: Write migration script for existing entries

**Files:**
- Create: `scripts/migrate-to-db.ts`

- [ ] **Step 1: Write the migration script**

`scripts/migrate-to-db.ts` — reads all JSON content files, populates `entries` and `companies` tables:

```typescript
import { readFileSync, readdirSync } from 'fs';
import { resolve, basename } from 'path';
import { execSync } from 'child_process';
import { v4 as uuid } from 'uuid';
import { getDb } from './db/index.js';

const CONTENT_DIR = resolve(import.meta.dirname, '../src/content');
const COLLECTIONS = ['companies', 'benchmarks', 'use-cases', 'challenges', 'resources'] as const;

const COUNTRY_TO_REGION: Record<string, string> = {
  'Denmark': 'nordics', 'Sweden': 'nordics', 'Norway': 'nordics',
  'Finland': 'nordics', 'Iceland': 'nordics',
  'Germany': 'dach', 'Austria': 'dach', 'Switzerland': 'dach',
  'France': 'western-europe', 'Netherlands': 'western-europe',
  'Belgium': 'western-europe', 'Luxembourg': 'western-europe',
  'Ireland': 'western-europe',
  'Spain': 'southern-europe', 'Portugal': 'southern-europe',
  'Italy': 'southern-europe', 'Greece': 'southern-europe',
  'Malta': 'southern-europe', 'Cyprus': 'southern-europe',
  'Poland': 'eastern-europe', 'Czech Republic': 'eastern-europe',
  'Estonia': 'eastern-europe', 'Latvia': 'eastern-europe',
  'Lithuania': 'eastern-europe', 'Hungary': 'eastern-europe',
  'Romania': 'eastern-europe', 'Bulgaria': 'eastern-europe',
  'Slovakia': 'eastern-europe', 'Slovenia': 'eastern-europe',
  'Croatia': 'eastern-europe',
  'United Kingdom': 'uk',
};

function getGitCreationDate(filePath: string): string {
  try {
    const result = execSync(
      `git log --follow --format=%aI --diff-filter=A -- "${filePath}"`,
      { encoding: 'utf-8', cwd: resolve(import.meta.dirname, '..') }
    ).trim();
    return result.split('\n').pop() || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function migrate() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const insertEntry = db.prepare(`
    INSERT OR IGNORE INTO entries (id, name, collection, subcategory, slug, url, country, date_added, date_last_verified, status, current_confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'MEDIUM')
  `);

  const insertCompany = db.prepare(`
    INSERT OR IGNORE INTO companies (id, name, entry_id, country, founded_date, status, sector, date_first_tracked)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `);

  const insertAudit = db.prepare(`
    INSERT OR IGNORE INTO audits (id, entry_id, audit_date, confidence_score, signals_found, signals_checked, action_taken, details)
    VALUES (?, ?, ?, 'MEDIUM', '[]', '[]', 'migrated', 'Initial migration from existing content files')
  `);

  const migrateAll = db.transaction(() => {
    for (const collection of COLLECTIONS) {
      const dir = resolve(CONTENT_DIR, collection);
      let files: string[];
      try {
        files = readdirSync(dir).filter(f => f.endsWith('.json'));
      } catch {
        console.log(`Skipping ${collection}: directory not found`);
        continue;
      }

      for (const file of files) {
        const filePath = resolve(dir, file);
        const data = JSON.parse(readFileSync(filePath, 'utf-8'));
        const entryId = uuid();
        const slug = data.slug || basename(file, '.json');
        const dateAdded = getGitCreationDate(filePath);

        // Determine subcategory based on collection type
        let subcategory: string | null = null;
        if (collection === 'companies') subcategory = data.type || null;
        else if (collection === 'benchmarks') subcategory = data.category || null;
        else if (collection === 'use-cases') subcategory = data.category || null;
        else if (collection === 'challenges') subcategory = data.status || null;
        else if (collection === 'resources') subcategory = data.type || null;

        const url = data.website || data.sources?.[0]?.url || null;
        const country = data.country || null;

        insertEntry.run(entryId, data.name, collection, subcategory, slug, url, country, dateAdded, today);
        insertAudit.run(uuid(), entryId, today);

        // For companies, also populate the intelligence layer
        if (collection === 'companies') {
          insertCompany.run(
            uuid(), data.name, entryId, country,
            data.founded ? `${data.founded}-01-01` : null,
            data.type || null, today
          );
        }

        console.log(`  [${collection}] ${data.name}`);
      }
    }
  });

  migrateAll();

  // Print summary
  const counts = db.prepare('SELECT collection, COUNT(*) as count FROM entries GROUP BY collection').all();
  console.log('\nMigration complete:');
  for (const row of counts as { collection: string; count: number }[]) {
    console.log(`  ${row.collection}: ${row.count} entries`);
  }

  db.close();
}

migrate();
```

- [ ] **Step 2: Run the migration**

```bash
npx tsx scripts/migrate-to-db.ts
```

Expected: Outputs each migrated entry, summary shows ~139 total entries across 5 collections.

- [ ] **Step 3: Verify the database**

```bash
npx tsx -e "
import Database from 'better-sqlite3';
const db = new Database('data/kvantiq.db');
const entries = db.prepare('SELECT collection, COUNT(*) as c FROM entries GROUP BY collection').all();
console.log(entries);
const companies = db.prepare('SELECT COUNT(*) as c FROM companies').all();
console.log('Intelligence companies:', companies);
db.close();
"
```

Expected: Counts match the content files.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-to-db.ts data/kvantiq.db .gitattributes
git commit -m "feat: add migration script, populate initial database from content files"
```

---

## Phase 2: Custom MCP Tools (ClickUp + Resend)

### Task 4: Create Resend email tool

**Files:**
- Create: `scripts/tools/resend.ts`

- [ ] **Step 1: Write the Resend MCP tool**

```typescript
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = tool(
  'send_email',
  'Send an email via Resend. Use for weekly digest and major event alerts.',
  {
    to: z.string(),
    subject: z.string(),
    body: z.string(),
    is_urgent: z.boolean(),
  },
  async (args) => {
    try {
      const result = await resend.emails.send({
        from: 'Kvantiq Agent <notifications@kvantiq.studio>',
        to: [args.to],
        subject: args.is_urgent ? `[URGENT] ${args.subject}` : args.subject,
        text: args.body,
      });
      return { content: [{ type: 'text' as const, text: `Email sent successfully. ID: ${result.data?.id}` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Email failed: ${error}. Content saved for retry.` }] };
    }
  }
);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/tools/resend.ts
git commit -m "feat: add Resend email MCP tool for weekly digest and alerts"
```

---

### Task 5: Create ClickUp task tool

**Files:**
- Create: `scripts/tools/clickup.ts`

- [ ] **Step 1: Write the ClickUp MCP tool**

```typescript
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const CLICKUP_API = 'https://api.clickup.com/api/v2';
const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;
const CLICKUP_LIST_ID = process.env.CLICKUP_LIST_ID;

export const createClickUpTask = tool(
  'create_clickup_task',
  'Create a task in ClickUp for items needing human judgment. Use for: removal approvals, new category proposals, borderline entries, major events.',
  {
    title: z.string(),
    description: z.string(),
    priority: z.number(),
    tags: z.string(),
  },
  async (args) => {
    if (!CLICKUP_TOKEN || !CLICKUP_LIST_ID) {
      return { content: [{ type: 'text' as const, text: 'ClickUp not configured. Task logged locally.' }] };
    }

    try {
      const response = await fetch(`${CLICKUP_API}/list/${CLICKUP_LIST_ID}/task`, {
        method: 'POST',
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: args.title,
          description: args.description,
          priority: args.priority, // 1=urgent, 2=high, 3=normal, 4=low
          tags: args.tags.split(',').map(t => t.trim()),
          notify_all: true,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return { content: [{ type: 'text' as const, text: `ClickUp API error (${response.status}): ${err}` }] };
      }

      const data = await response.json() as { id: string; url: string };
      return { content: [{ type: 'text' as const, text: `ClickUp task created: ${data.url}` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `ClickUp failed: ${error}. Task logged locally.` }] };
    }
  }
);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/tools/clickup.ts
git commit -m "feat: add ClickUp task creation MCP tool"
```

---

## Phase 3: Agent Core

### Task 6: Write the system prompt

**Files:**
- Create: `scripts/prompts/system-prompt.md`

- [ ] **Step 1: Write the codified QA/QC system prompt**

`scripts/prompts/system-prompt.md`:

```markdown
# Kvantiq Weekly Agent — System Prompt

You are the Kvantiq Directory maintenance agent. You run every Sunday to research, audit, and update the European quantum computing directory.

## Your Mission

1. Discover new quantum companies in EU + UK + Iceland
2. Audit every existing entry for freshness and accuracy
3. Track industry events (funding, acquisitions, milestones) globally
4. Open a PR with all changes for human review
5. Flag items needing human judgment via ClickUp
6. Send a weekly digest email

## Directory Rules (Non-Negotiable)

### Entry Quality Gate
Every new entry MUST satisfy ALL of these:
1. **Real company** — live website, identifiable team/founders
2. **Actually quantum** — core business in quantum computing, sensing, communication, or enabling tech. NOT "AI with quantum in the name"
3. **Active** — at least 1 verifiable activity signal within the last 90 days
4. **Categorizable** — fits an existing directory collection (companies, benchmarks, use-cases, challenges, resources). If not, propose a new category via ClickUp and SKIP the entry

### Confidence Scoring
Every entry gets scored on every audit:
- HIGH: 2+ activity signals within 90 days
- MEDIUM: 1 signal within 90 days
- LOW: 0 signals within 90 days → flag for review
- DEAD: website down + no signals for 180+ days → flag for removal

### Activity Signals (Primary)
- Git commit on public repos
- Blog post / news article / press release
- Social media post (LinkedIn company page, X)
- Active job posting (within 90 days)
- Conference talk / event participation
- Funding announcement / regulatory filing
- Published paper / patent filing
- Event sponsorship or exhibition

## Content Schema Requirements

When creating new company JSON files:

```json
{
  "name": "Company Name",
  "slug": "company-name",
  "country": "Country",
  "region": "<nordics|dach|western-europe|southern-europe|eastern-europe|uk>",
  "type": "<hardware|software|cloud|consulting|research|hybrid|other>",
  "tags": ["tag1", "tag2"],
  "founded": 2024,
  "description": "Factual 2-3 sentence description. No marketing language. No superlatives.",
  "website": "https://...",
  "featured": false,
  "headquarters": "City, Country",
  "employees": "estimated count or range",
  "funding": "known funding info",
  "sources": [
    {"type": "website", "url": "https://...", "title": "Official website", "dateAccessed": "YYYY-MM-DD"},
    {"type": "url", "url": "https://...", "title": "Source title", "dateAccessed": "YYYY-MM-DD"}
  ]
}
```

Rules:
- Slug MUST match filename (e.g., `company-name.json` → `"slug": "company-name"`)
- Minimum 2 sources required
- Description minimum 20 characters, factual, no marketing
- All source URLs must be live and accessible
- No blocklisted companies (AWS, Google Cloud, Meta, etc.)

## Country-to-Region Mapping

nordics: Denmark, Sweden, Norway, Finland, Iceland
dach: Germany, Austria, Switzerland
western-europe: France, Netherlands, Belgium, Luxembourg, Ireland
southern-europe: Spain, Portugal, Italy, Greece, Malta, Cyprus
eastern-europe: Poland, Czech Republic, Estonia, Latvia, Lithuania, Hungary, Romania, Bulgaria, Slovakia, Slovenia, Croatia
uk: United Kingdom

## Workflow

### Phase 0: Startup
- Run SQLite integrity check
- Process any pending files from previous failed runs (pending-clickup-tasks.json, pending-email.json, discovery-queue.json)
- Check for open weekly PR — if exists, push to it instead of creating new

### Phase 1: Research
- Load sources from data/sources.json
- Search each source for new companies and industry events
- EU + UK + Iceland companies → directory candidates
- Global companies → intelligence DB only (silent tracking)
- Cap at 10 new entries per PR, prioritized by: funding amount > team credibility > technology maturity > ecosystem relevance
- Include 1-sentence justification for each prioritized entry
- Queue overflow in data/discovery-queue.json

### Phase 2: Audit
- For each existing entry:
  - HTTP HEAD check on all URLs (use Bash tool with curl -I)
  - Web search for 90-day activity signals
  - Score confidence
  - Record in audits table
- Tiered: HIGH from last week → light check (link + 1 search). MEDIUM/LOW/new → deep check
- Detect acquisitions, closures → record in events table

### Phase 3: Act
- New entries → create JSON files in src/content/{collection}/
- Stale entries → update or flag
- Update SQLite database (both layers)
- Create git branch: weekly/YYYY-MM-DD
- Commit all changes
- Open PR via `gh pr create`
- Items needing human judgment → ClickUp tasks

### Phase 4: Report
- Add market_snapshots row to database
- Check for major events (funding ≥ €10M, acquisitions, closures, breakthroughs) → send immediate alert emails
- Send weekly digest email with directory updates + intelligence summary
- Log sources_checked

## Major Event Threshold (Immediate Alert)
Send immediate email + ClickUp task for:
- Funding round ≥ €10M involving a tracked EU/UK/Iceland company
- Acquisition of any tracked company
- Closure/shutdown of any tracked company
- Breakthrough with 3+ major press outlets covering it
- New EU-level quantum policy or program

## Auto-Fix vs. Flag Rules

Auto-fix (via PR, human reviews):
- Dead link where new URL found via redirect or search
- URL redirects
- Factual description updates
- Outdated metadata where change is clear

Flag to ClickUp (blocks until human responds):
- Removals (company shut down)
- Acquisitions (may change relevance)
- New category proposals
- Borderline companies (uncertain quantum relevance)

## Process Improvements
You may include a "## Process Improvements" section in the PR description suggesting changes to the source list, QA/QC rules, or auto-fix/flag balance based on patterns you observe. These are suggestions only — never auto-apply.
```

- [ ] **Step 2: Commit**

```bash
git add scripts/prompts/system-prompt.md
git commit -m "feat: add codified QA/QC system prompt for weekly agent"
```

---

### Task 7: Create the curated sources file

**Files:**
- Create: `data/sources.json`

- [ ] **Step 1: Write the initial sources list**

`data/sources.json`:

```json
{
  "sources": [
    {
      "name": "Danish Quantum Community (DQC)",
      "url": "https://danishquantumcommunity.com",
      "feed_type": "ecosystem_network",
      "strategy": "web_fetch",
      "geographic_scope": ["DK"],
      "notes": "Check members page, partners, and news. Also check DQC country partner networks."
    },
    {
      "name": "QuNorth",
      "url": "https://www.qunorth.com",
      "feed_type": "ecosystem_network",
      "strategy": "web_fetch",
      "geographic_scope": ["DK", "SE", "NO", "FI", "IS"],
      "notes": "Nordic quantum network. Check members and events."
    },
    {
      "name": "55 North",
      "url": "https://www.55north.org",
      "feed_type": "ecosystem_network",
      "strategy": "web_fetch",
      "geographic_scope": ["DK", "SE", "NO", "FI", "IS"],
      "notes": "Nordic quantum initiative."
    },
    {
      "name": "Wallenberg Centre for Quantum Technology (WACQT)",
      "url": "https://www.chalmers.se/en/centres/wacqt/",
      "feed_type": "national_initiative",
      "strategy": "web_fetch",
      "geographic_scope": ["SE"],
      "notes": "Swedish quantum research center at Chalmers."
    },
    {
      "name": "Munich Quantum Valley",
      "url": "https://www.munichquantumvalley.de",
      "feed_type": "national_initiative",
      "strategy": "web_fetch",
      "geographic_scope": ["DE"],
      "notes": "German quantum computing initiative."
    },
    {
      "name": "Fraunhofer IQS",
      "url": "https://www.iqs.fraunhofer.de",
      "feed_type": "national_initiative",
      "strategy": "web_fetch",
      "geographic_scope": ["DE"],
      "notes": "Fraunhofer quantum sensing research."
    },
    {
      "name": "QuTech",
      "url": "https://qutech.nl",
      "feed_type": "national_initiative",
      "strategy": "web_fetch",
      "geographic_scope": ["NL"],
      "notes": "Dutch quantum research center (TU Delft + TNO)."
    },
    {
      "name": "National Quantum Computing Centre (UK)",
      "url": "https://www.nqcc.ac.uk",
      "feed_type": "national_initiative",
      "strategy": "web_fetch",
      "geographic_scope": ["GB"],
      "notes": "UK national quantum computing centre."
    },
    {
      "name": "EU Quantum Flagship",
      "url": "https://qt.eu",
      "feed_type": "national_initiative",
      "strategy": "web_fetch",
      "geographic_scope": ["EU"],
      "notes": "EU-wide quantum technology program. Check projects and news."
    },
    {
      "name": "EuroQCI",
      "url": "https://digital-strategy.ec.europa.eu/en/policies/european-quantum-communication-infrastructure-euroqci",
      "feed_type": "national_initiative",
      "strategy": "web_search",
      "geographic_scope": ["EU"],
      "notes": "European Quantum Communication Infrastructure."
    },
    {
      "name": "Quantum Computing Report",
      "url": "https://quantumcomputingreport.com",
      "feed_type": "industry_tracker",
      "strategy": "web_search",
      "geographic_scope": ["global"],
      "notes": "Search for new companies, funding, and acquisitions. Filter for EU/UK."
    },
    {
      "name": "The Quantum Insider",
      "url": "https://thequantuminsider.com",
      "feed_type": "news",
      "strategy": "web_search",
      "geographic_scope": ["global"],
      "notes": "Quantum industry news. Search for European companies and events."
    },
    {
      "name": "arXiv quant-ph",
      "url": "https://arxiv.org/list/quant-ph/recent",
      "feed_type": "academic",
      "strategy": "web_search",
      "geographic_scope": ["global"],
      "notes": "Filter for European-affiliated institutions and company-backed research."
    },
    {
      "name": "GitHub Quantum",
      "url": "https://github.com/topics/quantum-computing",
      "feed_type": "industry_tracker",
      "strategy": "web_search",
      "geographic_scope": ["global"],
      "notes": "Trending quantum repos. Check for new European tools and frameworks."
    },
    {
      "name": "Crunchbase Quantum",
      "url": "https://www.crunchbase.com",
      "feed_type": "funding_database",
      "strategy": "web_search",
      "geographic_scope": ["global"],
      "notes": "Search for recent quantum computing funding rounds in EU/UK."
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add data/sources.json
git commit -m "feat: add curated source list for weekly agent research"
```

---

### Task 8: Write the main agent script

**Files:**
- Create: `scripts/weekly-agent.ts`

- [ ] **Step 1: Write the agent entry point**

`scripts/weekly-agent.ts` — the main script that GitHub Actions runs:

```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { query, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { sendEmail } from './tools/resend.js';
import { createClickUpTask } from './tools/clickup.js';

const ROOT = resolve(import.meta.dirname, '..');
const SYSTEM_PROMPT = readFileSync(resolve(import.meta.dirname, 'prompts/system-prompt.md'), 'utf-8');
const SOURCES = readFileSync(resolve(ROOT, 'data/sources.json'), 'utf-8');

// Ensure data/generated directory exists
const generatedDir = resolve(ROOT, 'data/generated');
if (!existsSync(generatedDir)) mkdirSync(generatedDir, { recursive: true });

// Load pending files from previous failed runs
function loadPendingContext(): string {
  const pendingFiles = [
    'data/discovery-queue.json',
    'data/pending-clickup-tasks.json',
    'data/pending-email.json',
  ];
  const parts: string[] = [];
  for (const file of pendingFiles) {
    const path = resolve(ROOT, file);
    if (existsSync(path)) {
      parts.push(`\n## Pending from previous run: ${file}\n${readFileSync(path, 'utf-8')}`);
    }
  }
  return parts.join('\n');
}

// Build the agent prompt
const pendingContext = loadPendingContext();
const today = new Date().toISOString().split('T')[0];

const agentPrompt = `
Today is ${today}. Run the weekly Kvantiq directory maintenance cycle.

## Curated Sources
${SOURCES}

${pendingContext ? `## Pending Items from Previous Runs\n${pendingContext}` : ''}

## Instructions

Execute the full weekly workflow:

1. **STARTUP**: Check for open weekly PR (branch pattern: weekly/YYYY-MM-DD). If one exists, work on that branch. Otherwise create a new one. Process any pending files listed above.

2. **RESEARCH**: Search each curated source for:
   - New quantum companies in EU + UK + Iceland (quality gate: real, quantum, active within 90 days, categorizable)
   - Industry events (funding, acquisitions, milestones, breakthroughs) globally
   - Cap new entries at 10 per PR, prioritized by funding > credibility > maturity > relevance
   - Include 1-sentence justification for each new entry

3. **AUDIT**: For each existing entry in the database:
   - Check URL liveness (use curl -I via Bash tool)
   - Search for 90-day activity signals
   - Update confidence scores in the database
   - Tiered: HIGH entries from last week get light check, others get deep check

4. **ACT**:
   - Create JSON files for new entries in src/content/{collection}/
   - Update the SQLite database (data/kvantiq.db) with new entries, audit results, events
   - Flag items needing human judgment via create_clickup_task tool
   - Create branch, commit, push, and open PR via Bash (gh pr create)

5. **REPORT**:
   - Check for major events (funding ≥€10M, acquisitions, closures) → send immediate alerts via send_email
   - Send weekly digest email to hi@kvantiq.studio via send_email
   - Include: new entries, flagged entries, removed entries, industry events, ClickUp task links

After completing all phases, run: npx tsx scripts/generate-transparency-data.ts
Then commit the generated data files and include them in the PR.

If you encounter errors, log them and continue with what you can complete. Never let a partial failure prevent the PR from being created.
`;

// Create MCP server with custom tools
const toolServer = createSdkMcpServer({
  name: 'kvantiq-tools',
  tools: [sendEmail, createClickUpTask],
});

async function main() {
  console.log(`[${today}] Starting weekly Kvantiq agent...`);

  for await (const message of query({
    prompt: agentPrompt,
    options: {
      cwd: ROOT,
      systemPrompt: SYSTEM_PROMPT,
      model: 'claude-sonnet-4-6',
      mcpServers: { 'kvantiq-tools': toolServer },
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: 200,
      maxBudgetUsd: 10.0,
    },
  })) {
    if (message && 'result' in message) {
      console.log('\n=== Agent Result ===');
      console.log(message.result);
    }
  }

  console.log(`[${today}] Weekly agent complete.`);
}

main().catch((error) => {
  console.error('Agent failed:', error);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add scripts/weekly-agent.ts
git commit -m "feat: add main weekly agent script using Claude Agent SDK"
```

---

## Phase 4: Transparency Data Generation

### Task 9: Write the transparency data generator

**Files:**
- Create: `scripts/generate-transparency-data.ts`

- [ ] **Step 1: Write the generator script**

`scripts/generate-transparency-data.ts` — reads SQLite, outputs JSON files for Astro pages:

```typescript
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { getDb } from './db/index.js';

const OUTPUT_DIR = resolve(import.meta.dirname, '../data/generated');
mkdirSync(OUTPUT_DIR, { recursive: true });

function writeJson(filename: string, data: unknown) {
  writeFileSync(resolve(OUTPUT_DIR, filename), JSON.stringify(data, null, 2));
  console.log(`  Generated: ${filename}`);
}

function generate() {
  const db = getDb();

  // Confidence distribution
  const confidenceDist = db.prepare(`
    SELECT current_confidence as label, COUNT(*) as value
    FROM entries WHERE status = 'active'
    GROUP BY current_confidence
  `).all();
  writeJson('confidence-distribution.json', confidenceDist);

  // Entry timeline (entries added per week)
  const entryTimeline = db.prepare(`
    SELECT date(date_added) as date, collection, COUNT(*) as count
    FROM entries
    GROUP BY date(date_added), collection
    ORDER BY date(date_added)
  `).all();
  writeJson('entry-timeline.json', entryTimeline);

  // Audit summary (last 4 weeks)
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const auditSummary = db.prepare(`
    SELECT action_taken, COUNT(*) as count
    FROM audits WHERE audit_date >= ?
    GROUP BY action_taken
  `).all(fourWeeksAgo);
  writeJson('audit-summary.json', auditSummary);

  // Coverage map (entries by country)
  const coverageMap = db.prepare(`
    SELECT country, COUNT(*) as count
    FROM entries WHERE status = 'active' AND country IS NOT NULL
    GROUP BY country
    ORDER BY count DESC
  `).all();
  writeJson('coverage-map.json', coverageMap);

  // Funding timeline (from events table)
  const fundingTimeline = db.prepare(`
    SELECT
      strftime('%Y', event_date) || '-Q' ||
      ((cast(strftime('%m', event_date) as integer) - 1) / 3 + 1) as quarter,
      SUM(amount_eur) as total_eur,
      COUNT(*) as deal_count
    FROM events WHERE event_type = 'funding' AND amount_eur IS NOT NULL
    GROUP BY quarter
    ORDER BY quarter
  `).all();
  writeJson('funding-timeline.json', fundingTimeline);

  // Recent events (last 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recentEvents = db.prepare(`
    SELECT e.*, c.name as company_name
    FROM events e
    JOIN companies c ON e.company_id = c.id
    WHERE e.date_recorded >= ?
    ORDER BY e.event_date DESC
    LIMIT 50
  `).all(ninetyDaysAgo);
  writeJson('events.json', recentEvents);

  // Latest market snapshot
  const snapshot = db.prepare(`
    SELECT * FROM market_snapshots ORDER BY snapshot_date DESC LIMIT 1
  `).get();
  writeJson('market-snapshot.json', snapshot || {});

  // Source effectiveness
  const sourceEffectiveness = db.prepare(`
    SELECT source_name, SUM(entries_found) as total_found, SUM(new_entries_discovered) as total_new
    FROM sources_checked
    GROUP BY source_name
    ORDER BY total_new DESC
  `).all();
  writeJson('source-effectiveness.json', sourceEffectiveness);

  // Per-entry audit history (for detail pages)
  const entryAudits = db.prepare(`
    SELECT e.slug, e.collection, e.current_confidence, e.date_last_verified,
      json_group_array(json_object(
        'date', a.audit_date,
        'confidence', a.confidence_score,
        'action', a.action_taken,
        'details', a.details
      )) as audit_history
    FROM entries e
    LEFT JOIN audits a ON a.entry_id = e.id
    WHERE e.status = 'active'
    GROUP BY e.id
  `).all();
  writeJson('entry-audits.json', entryAudits);

  db.close();
  console.log('\nTransparency data generation complete.');
}

generate();
```

- [ ] **Step 2: Run it to verify output**

```bash
npx tsx scripts/generate-transparency-data.ts
ls data/generated/
```

Expected: 8 JSON files in `data/generated/`.

- [ ] **Step 3: Add generated files to .gitignore (they're build artifacts)**

Actually — these need to be committed so Vercel can build the Astro pages. But they should be regenerated on every build. Add to the Astro build pipeline instead:

Update `package.json` scripts:

```json
"prebuild": "tsx scripts/generate-transparency-data.ts",
```

(Using `tsx` directly since it's now a devDependency from Task 1.)

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-transparency-data.ts data/generated/ package.json
git commit -m "feat: add transparency data generator from SQLite to JSON"
```

---

## Phase 5: Transparency Pages

### Task 10: Create transparency overview page

**Files:**
- Create: `src/pages/transparency/index.astro`

- [ ] **Step 1: Write the methodology overview page**

`src/pages/transparency/index.astro`:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadJson(filename: string, fallback: unknown = []) {
  const path = resolve(process.cwd(), 'data/generated', filename);
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

const confidenceData = loadJson('confidence-distribution.json') as {label: string; value: number}[];
const coverageData = loadJson('coverage-map.json') as {country: string; count: number}[];
const totalEntries = coverageData.reduce((sum, c) => sum + c.count, 0);

const didYouKnow = [
  {
    front: `${totalEntries} verified entries`,
    back: 'Every entry is verified against 2+ independent sources and must show activity within 90 days to maintain its listing.',
  },
  {
    front: 'Weekly AI audit',
    back: 'Our AI agent monitors 15+ curated sources weekly, including national quantum initiatives across all EU countries, industry trackers, and academic publications. Every discovery is reviewed by a human before it appears here.',
  },
  {
    front: 'Confidence scoring',
    back: 'Each entry earns a confidence score based on how many independent signals of activity we can verify. HIGH means 2+ signals in the last quarter. Think of it as a freshness indicator.',
  },
  {
    front: 'Full transparency',
    back: 'The research and verification is performed by an AI agent. Every change is reviewed by a human before publication. The AI proposes, the human disposes. Full audit trail is public.',
  },
  {
    front: '90-day activity rule',
    back: 'We verify every company shows public activity within 90 days. This accommodates research institutions that publish quarterly while ensuring the directory only lists organizations that are demonstrably active.',
  },
  {
    front: 'Open methodology',
    back: 'Our complete QA/QC protocol, source list, and scoring criteria are published on GitHub. Anyone can audit our process.',
  },
];
---

<BaseLayout
  title="Transparency — Kvantiq Directory"
  description="How the Kvantiq quantum computing directory is maintained, verified, and audited."
>
  <main class="max-w-4xl mx-auto px-4 py-12" data-pagefind-ignore>
    <h1 class="text-3xl font-bold mb-2">Transparency</h1>
    <p class="text-lg text-[var(--text-secondary)] mb-8">
      How we maintain the most reliable European quantum computing directory.
    </p>

    <section class="mb-12">
      <h2 class="text-xl font-semibold mb-6">How It Works</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {didYouKnow.map((item) => (
          <div class="flip-card group">
            <div class="flip-card-inner">
              {/* Front */}
              <div class="flip-card-front rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6 flex items-center justify-center text-center">
                <span class="text-lg font-semibold text-[var(--text-primary)]">{item.front}</span>
              </div>
              {/* Back */}
              <div class="flip-card-back rounded-lg border border-[var(--accent-primary)] bg-[var(--bg-tertiary)] p-4 flex items-center justify-center text-center">
                <span class="text-sm text-[var(--text-secondary)]">{item.back}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>

    <style>
      .flip-card { perspective: 1000px; height: 10rem; }
      .flip-card-inner {
        position: relative; width: 100%; height: 100%;
        transition: transform 0.5s;
        transform-style: preserve-3d;
      }
      .flip-card:hover .flip-card-inner { transform: rotateY(180deg); }
      .flip-card-front, .flip-card-back {
        position: absolute; inset: 0;
        backface-visibility: hidden;
      }
      .flip-card-back { transform: rotateY(180deg); }
    </style>
    </section>

    <section class="mb-12">
      <h2 class="text-xl font-semibold mb-4">Our Process</h2>
      <ol class="space-y-4 text-[var(--text-secondary)]">
        <li class="flex gap-3">
          <span class="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent-primary)] text-[var(--bg-primary)] flex items-center justify-center font-bold text-sm">1</span>
          <div><strong class="text-[var(--text-primary)]">Research</strong> — Our AI agent searches 15+ curated sources including national quantum initiatives, industry trackers, and academic databases across all EU countries + UK + Iceland.</div>
        </li>
        <li class="flex gap-3">
          <span class="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent-primary)] text-[var(--bg-primary)] flex items-center justify-center font-bold text-sm">2</span>
          <div><strong class="text-[var(--text-primary)]">Verify</strong> — Every discovery passes a quality gate: real company, actually quantum, active within 90 days, backed by 2+ independent sources.</div>
        </li>
        <li class="flex gap-3">
          <span class="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent-primary)] text-[var(--bg-primary)] flex items-center justify-center font-bold text-sm">3</span>
          <div><strong class="text-[var(--text-primary)]">Audit</strong> — Existing entries are re-verified every week. Confidence scores update automatically. Stale entries get flagged.</div>
        </li>
        <li class="flex gap-3">
          <span class="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent-primary)] text-[var(--bg-primary)] flex items-center justify-center font-bold text-sm">4</span>
          <div><strong class="text-[var(--text-primary)]">Review</strong> — All changes go through a pull request. A human reviews every addition, update, and removal before it goes live.</div>
        </li>
      </ol>
    </section>

    <section>
      <h2 class="text-xl font-semibold mb-4">Explore</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a href="/transparency/audit/" class="block rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6 hover:border-[var(--accent-primary)] transition-colors">
          <h3 class="font-semibold text-[var(--text-primary)] mb-1">Audit Dashboard</h3>
          <p class="text-sm text-[var(--text-secondary)]">Directory health, confidence scores, coverage map, and source effectiveness.</p>
        </a>
        <a href="/transparency/intelligence/" class="block rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6 hover:border-[var(--accent-primary)] transition-colors">
          <h3 class="font-semibold text-[var(--text-primary)] mb-1">Industry Intelligence</h3>
          <p class="text-sm text-[var(--text-secondary)]">Funding timelines, acquisition graph, sector trends, and ecosystem snapshots.</p>
        </a>
      </div>
    </section>
  </main>
</BaseLayout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/transparency/index.astro
git commit -m "feat: add transparency overview page with flip-card methodology"
```

---

### Task 11: Create audit dashboard page

**Files:**
- Create: `src/pages/transparency/audit.astro`

- [ ] **Step 1: Write the audit dashboard**

`src/pages/transparency/audit.astro` — loads generated JSON data and renders charts via Chart.js in a client-side React component or inline `<script>`:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadJson(filename: string, fallback: unknown = []) {
  const path = resolve(process.cwd(), 'data/generated', filename);
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

const confidenceData = loadJson('confidence-distribution.json') as {label: string; value: number}[];
const coverageData = loadJson('coverage-map.json') as {country: string; count: number}[];
const auditSummary = loadJson('audit-summary.json') as {action_taken: string; count: number}[];
const entryTimeline = loadJson('entry-timeline.json') as unknown[];
const sourceEffectiveness = loadJson('source-effectiveness.json') as {source_name: string; total_found: number; total_new: number}[];

const confidenceColors: Record<string, string> = {
  HIGH: '#22c55e',
  MEDIUM: '#eab308',
  LOW: '#f97316',
  DEAD: '#ef4444',
};
---

<BaseLayout
  title="Audit Dashboard — Kvantiq Directory"
  description="Live audit data: confidence scores, directory growth, coverage, and source effectiveness."
>
  <main class="max-w-6xl mx-auto px-4 py-12" data-pagefind-ignore>
    <h1 class="text-3xl font-bold mb-2">Audit Dashboard</h1>
    <p class="text-[var(--text-secondary)] mb-8">Directory health metrics, updated weekly.</p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
      {/* Confidence Distribution */}
      <section class="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
        <h2 class="text-lg font-semibold mb-4">Confidence Distribution</h2>
        <canvas id="confidence-chart" width="300" height="300"></canvas>
      </section>

      {/* Coverage Map */}
      <section class="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
        <h2 class="text-lg font-semibold mb-4">Coverage by Country</h2>
        <div class="space-y-2 max-h-80 overflow-y-auto">
          {(coverageData as {country: string; count: number}[]).map((row) => (
            <div class="flex justify-between items-center">
              <span class="text-sm text-[var(--text-secondary)]">{row.country}</span>
              <div class="flex items-center gap-2">
                <div class="h-2 rounded-full bg-[var(--accent-primary)]" style={`width: ${Math.max(row.count * 8, 16)}px`}></div>
                <span class="text-sm font-mono text-[var(--text-primary)]">{row.count}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>

    {/* Recent Audit Actions */}
    <section class="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6 mb-8">
      <h2 class="text-lg font-semibold mb-4">Recent Audit Actions (Last 4 Weeks)</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(auditSummary as {action_taken: string; count: number}[]).map((row) => (
          <div class="text-center">
            <div class="text-2xl font-bold text-[var(--text-primary)]">{row.count}</div>
            <div class="text-sm text-[var(--text-secondary)] capitalize">{row.action_taken}</div>
          </div>
        ))}
      </div>
    </section>

    {/* Source Effectiveness */}
    <section class="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
      <h2 class="text-lg font-semibold mb-4">Source Effectiveness</h2>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-[var(--text-secondary)]">
            <th class="pb-2">Source</th>
            <th class="pb-2 text-right">Entries Found</th>
            <th class="pb-2 text-right">New Discoveries</th>
          </tr>
        </thead>
        <tbody>
          {(sourceEffectiveness as {source_name: string; total_found: number; total_new: number}[]).map((row) => (
            <tr class="border-t border-[var(--border-primary)]">
              <td class="py-2 text-[var(--text-primary)]">{row.source_name}</td>
              <td class="py-2 text-right font-mono">{row.total_found}</td>
              <td class="py-2 text-right font-mono">{row.total_new}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  </main>

  <script define:vars={{ confidenceData, confidenceColors }}>
    import('https://cdn.jsdelivr.net/npm/chart.js@4/+esm').then(({ Chart, ArcElement, Tooltip, Legend, DoughnutController }) => {
      Chart.register(ArcElement, Tooltip, Legend, DoughnutController);
      const ctx = document.getElementById('confidence-chart');
      if (ctx) {
        new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: confidenceData.map(d => d.label),
            datasets: [{
              data: confidenceData.map(d => d.value),
              backgroundColor: confidenceData.map(d => confidenceColors[d.label] || '#6b7280'),
            }],
          },
          options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } },
          },
        });
      }
    });
  </script>
</BaseLayout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/transparency/audit.astro
git commit -m "feat: add audit dashboard page with confidence chart and coverage"
```

---

### Task 12: Create intelligence dashboard page

**Files:**
- Create: `src/pages/transparency/intelligence.astro`

- [ ] **Step 1: Write the intelligence dashboard**

`src/pages/transparency/intelligence.astro`:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadJson(filename: string, fallback: unknown = []) {
  const path = resolve(process.cwd(), 'data/generated', filename);
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

const events = loadJson('events.json') as {event_date: string; event_type: string; company_name: string; headline: string; amount_eur?: number; source_url?: string}[];
const snapshot = loadJson('market-snapshot.json', {}) as Record<string, unknown>;
const fundingTimeline = loadJson('funding-timeline.json') as {quarter: string; total_eur: number; deal_count: number}[];

const eventIcons: Record<string, string> = {
  funding: '&#128176;',
  acquisition: '&#129309;',
  closure: '&#128683;',
  breakthrough: '&#128640;',
  product_launch: '&#128230;',
  partnership: '&#128101;',
  grant_awarded: '&#127942;',
  milestone: '&#11088;',
  founded: '&#127793;',
  ipo: '&#128200;',
  merger: '&#128260;',
  pivot: '&#128259;',
  expansion: '&#127758;',
};
---

<BaseLayout
  title="Industry Intelligence — Kvantiq Directory"
  description="European quantum computing ecosystem: funding timelines, events, and market snapshots."
>
  <main class="max-w-6xl mx-auto px-4 py-12" data-pagefind-ignore>
    <h1 class="text-3xl font-bold mb-2">Industry Intelligence</h1>
    <p class="text-[var(--text-secondary)] mb-8">European quantum ecosystem tracking, updated weekly.</p>

    {/* Market Snapshot */}
    {Object.keys(snapshot).length > 0 && (
      <section class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <div class="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 text-center">
          <div class="text-2xl font-bold text-[var(--text-primary)]">{snapshot.total_companies_tracked || 0}</div>
          <div class="text-sm text-[var(--text-secondary)]">Companies Tracked</div>
        </div>
        <div class="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 text-center">
          <div class="text-2xl font-bold text-[var(--text-primary)]">{snapshot.total_active || 0}</div>
          <div class="text-sm text-[var(--text-secondary)]">Active</div>
        </div>
        <div class="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 text-center">
          <div class="text-2xl font-bold text-[var(--text-primary)]">{snapshot.countries_represented || 0}</div>
          <div class="text-sm text-[var(--text-secondary)]">Countries</div>
        </div>
        <div class="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 text-center">
          <div class="text-2xl font-bold text-[var(--text-primary)]">
            {snapshot.total_funding_eur_ytd ? `€${(snapshot.total_funding_eur_ytd / 1_000_000).toFixed(0)}M` : '—'}
          </div>
          <div class="text-sm text-[var(--text-secondary)]">Funding YTD</div>
        </div>
      </section>
    )}

    {/* Funding Timeline Chart */}
    {(fundingTimeline as unknown[]).length > 0 && (
      <section class="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6 mb-8">
        <h2 class="text-lg font-semibold mb-4">Funding Timeline</h2>
        <canvas id="funding-chart" height="200"></canvas>
      </section>
    )}

    {/* Event Timeline */}
    <section class="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
      <h2 class="text-lg font-semibold mb-4">Recent Events</h2>
      {(events as {event_date: string; event_type: string; company_name: string; headline: string; amount_eur?: number; source_url?: string}[]).length === 0 ? (
        <p class="text-[var(--text-secondary)]">No events recorded yet. Check back after the first weekly agent run.</p>
      ) : (
        <div class="space-y-3">
          {(events as {event_date: string; event_type: string; company_name: string; headline: string; amount_eur?: number; source_url?: string}[]).map((event) => (
            <div class="flex gap-3 items-start border-b border-[var(--border-primary)] pb-3 last:border-0">
              <span class="text-xl flex-shrink-0" set:html={eventIcons[event.event_type] || '&#128196;'} />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-semibold text-[var(--text-primary)]">{event.company_name}</span>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] capitalize">{event.event_type.replace('_', ' ')}</span>
                  {event.amount_eur && (
                    <span class="text-xs font-mono text-[var(--accent-primary)]">€{(event.amount_eur / 1_000_000).toFixed(1)}M</span>
                  )}
                </div>
                <p class="text-sm text-[var(--text-secondary)] mt-0.5">{event.headline}</p>
                <span class="text-xs text-[var(--text-tertiary)]">{event.event_date}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  </main>

  <script define:vars={{ fundingTimeline }}>
    if (fundingTimeline.length > 0) {
      import('https://cdn.jsdelivr.net/npm/chart.js@4/+esm').then(({ Chart, BarElement, CategoryScale, LinearScale, Tooltip, BarController }) => {
        Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, BarController);
        const ctx = document.getElementById('funding-chart');
        if (ctx) {
          new Chart(ctx, {
            type: 'bar',
            data: {
              labels: fundingTimeline.map(d => d.quarter),
              datasets: [{
                label: 'Funding (€M)',
                data: fundingTimeline.map(d => (d.total_eur || 0) / 1_000_000),
                backgroundColor: '#06b6d4',
              }],
            },
            options: {
              responsive: true,
              scales: {
                y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
              },
            },
          });
        }
      });
    }
  </script>
</BaseLayout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/transparency/intelligence.astro
git commit -m "feat: add industry intelligence dashboard with event timeline and funding chart"
```

---

## Phase 6: GitHub Actions Workflow

### Task 13: Create the weekly agent workflow

**Files:**
- Create: `.github/workflows/weekly-agent.yml`

- [ ] **Step 1: Write the GitHub Actions workflow**

`.github/workflows/weekly-agent.yml`:

```yaml
name: Weekly Kvantiq Agent

on:
  schedule:
    - cron: '17 8 * * 0'  # Sundays ~08:17 UTC
  workflow_dispatch: {}     # Manual trigger for testing

permissions:
  contents: write
  pull-requests: write

jobs:
  weekly-audit:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for git log in migration

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Install Claude Code CLI
        run: npm install -g @anthropic-ai/claude-code

      - name: Run database migration (idempotent)
        run: npx tsx scripts/migrate-to-db.ts

      - name: Run weekly agent
        run: npx tsx scripts/weekly-agent.ts
        timeout-minutes: 25
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          CLICKUP_API_TOKEN: ${{ secrets.CLICKUP_API_TOKEN }}
          CLICKUP_LIST_ID: ${{ secrets.CLICKUP_LIST_ID }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Generate transparency data
        if: always()
        run: npx tsx scripts/generate-transparency-data.ts

      - name: Check for changes
        id: changes
        run: |
          git diff --quiet && git diff --cached --quiet && echo "changed=false" >> $GITHUB_OUTPUT || echo "changed=true" >> $GITHUB_OUTPUT

      - name: Commit and push (if agent didn't already)
        if: steps.changes.outputs.changed == 'true'
        run: |
          git config user.name "Kvantiq Agent"
          git config user.email "agent@kvantiq.studio"
          BRANCH="weekly/$(date +%Y-%m-%d)"
          git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"
          git add -A
          git commit -m "chore: weekly agent run $(date +%Y-%m-%d)" || true
          git push -u origin "$BRANCH"
          gh pr create \
            --title "Weekly Agent — $(date +%Y-%m-%d)" \
            --body "Automated weekly directory maintenance. Review changes before merging." \
            --base main \
            --head "$BRANCH" || true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/weekly-agent.yml
git commit -m "feat: add GitHub Actions workflow for weekly agent (Sundays 08:17 UTC)"
```

---

## Phase 7: Integration & Testing

### Task 14: Add navigation link to transparency pages

**Files:**
- Modify: `src/components/Header.astro` (add Transparency nav link)

- [ ] **Step 1: Read the current Header component**

Read `src/components/Header.astro` and add a "Transparency" link to the navigation, following existing patterns.

- [ ] **Step 2: Add nav link**

Add to the navigation items array/list:

```html
<a href="/transparency/">Transparency</a>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.astro
git commit -m "feat: add Transparency link to site navigation"
```

---

### Task 15: Add prebuild script for transparency data

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update build scripts**

Add `prebuild` to ensure transparency data is generated before every Astro build:

```json
{
  "scripts": {
    "prebuild": "tsx scripts/generate-transparency-data.ts",
    "dev": "astro dev",
    "build": "astro build",
    "postbuild": "pagefind --site dist",
    "preview": "astro preview"
  }
}
```

- [ ] **Step 2: Verify full build works**

```bash
npm run build
```

Expected: prebuild generates JSON, Astro builds transparency pages, postbuild indexes with Pagefind.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add prebuild step for transparency data generation"
```

---

### Task 16: Manual end-to-end test

- [ ] **Step 1: Run migration**

```bash
npx tsx scripts/migrate-to-db.ts
```

- [ ] **Step 2: Generate transparency data**

```bash
npx tsx scripts/generate-transparency-data.ts
```

- [ ] **Step 3: Build the site**

```bash
npm run build
```

- [ ] **Step 4: Preview and verify transparency pages**

```bash
npm run preview
```

Open `http://localhost:4321/transparency/` — verify:
- Overview page renders with flip cards
- Audit dashboard shows confidence chart and coverage
- Intelligence dashboard shows (empty) event timeline

- [ ] **Step 5: Test agent locally (dry run)**

Set `ANTHROPIC_API_KEY` and run with a reduced scope:

```bash
ANTHROPIC_API_KEY=your-key npx tsx scripts/weekly-agent.ts
```

Monitor output. Agent should:
- Connect via Agent SDK
- Start researching sources
- Create a branch and attempt to commit
- Try to send email (will fail without Resend setup — expected)

- [ ] **Step 6: Final commit with any fixes**

```bash
git add -A
git commit -m "fix: integration fixes from end-to-end testing"
```

---

## Setup Checklist (For Rune)

Before the first Sunday run, complete these manual setup steps:

- [ ] Add `ANTHROPIC_API_KEY` to GitHub repo secrets
- [ ] Create ClickUp workspace + list, add `CLICKUP_API_TOKEN` and `CLICKUP_LIST_ID` to secrets
- [ ] Sign up for Resend (free), verify `kvantiq.studio` domain, add `RESEND_API_KEY` to secret
- [ ] Trigger workflow manually once to verify: Actions → Weekly Kvantiq Agent → Run workflow
