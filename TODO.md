# Weekly Agent — Remaining Tasks

Plan: `docs/superpowers/plans/2026-03-21-weekly-agent.md`
Spec: `docs/superpowers/specs/2026-03-21-weekly-agent-design.md`
Branch: `feature/weekly-agent`

## Phase 1: Data Layer

- [x] Task 2: Implement SQLite schema initialization in `scripts/db/schema.ts` and `scripts/db/index.ts`
- [x] Task 3: Write migration script `scripts/migrate-to-db.ts` to import existing JSON entries into SQLite

## Phase 2: Custom MCP Tools

- [x] Task 4: Implement Resend email tool in `scripts/tools/mcp-server.ts`
- [x] Task 5: Implement ClickUp task tool in `scripts/tools/mcp-server.ts`

## Phase 3: Agent Core

- [x] Task 6: Write the system prompt in `scripts/prompts/system-prompt.md`
- [x] Task 7: Create curated sources file `data/sources.json` with all research sources from spec
- [x] Task 8: Write the main agent script `scripts/weekly-agent.ts` (uses Claude CLI, not Agent SDK)

## Phase 4: Transparency Data Generation

- [x] Task 9: Write transparency data generator `scripts/generate-transparency-data.ts` that queries SQLite and outputs JSON to `data/generated/`

## Phase 5: Transparency Pages

- [x] Task 10: Create transparency overview page `src/pages/transparency/index.astro`
- [x] Task 11: Create audit dashboard page `src/pages/transparency/audit.astro` with Chart.js
- [x] Task 12: Create intelligence dashboard page `src/pages/transparency/intelligence.astro` with Chart.js

## Phase 6: GitHub Actions

- [x] Task 13: Create weekly agent workflow `.github/workflows/weekly-agent.yml` (Sunday cron, runs agent, commits DB)

## Phase 7: Integration & Testing

- [x] Task 14: Add navigation link to transparency pages in Header component
- [x] Task 15: Add prebuild script for transparency data generation in `package.json`
- [ ] Task 16: Manual end-to-end test — run migration, run agent dry-run, verify transparency pages build

## Post-review fixes applied

- [x] Added UNIQUE(collection, slug) index to entries table for idempotent migration
- [x] Added performance indexes on entries, audits, events, companies tables
- [x] Fixed migration to use git creation dates instead of TODAY for date_added
- [x] Fixed founded_date format to ISO 8601 (YYYY-01-01)
- [x] Fixed intelligence dashboard field name mismatches (quarter/total_eur, market snapshot fields)
- [x] Added actual fallback file writing to MCP server tools on failure
- [x] Added 11 missing curated sources from spec (Magne, QBusiness, SINTEF, VTT, DLR, AIT, Innsbruck, ETH, EPFL, EIC)
- [x] Migration now prefers worktree content dir, falls back to repo root
