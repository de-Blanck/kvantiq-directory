# Weekly Agent — Remaining Tasks

Plan: `docs/superpowers/plans/2026-03-21-weekly-agent.md`
Spec: `docs/superpowers/specs/2026-03-21-weekly-agent-design.md`
Branch: `feature/weekly-agent`

## Phase 1: Data Layer

- [x] Task 2: Implement SQLite schema initialization in `scripts/db/schema.ts` and `scripts/db/index.ts` (files exist, need implementation per plan)
- [x] Task 3: Write migration script `scripts/db/migrate.ts` to import existing JSON entries from `.worktrees/feature-directory-site/src/content/` into SQLite

## Phase 2: Custom MCP Tools

- [ ] Task 4: Implement Resend email tool in `scripts/tools/resend.ts` (file exists, need implementation per plan)
- [ ] Task 5: Implement ClickUp task tool in `scripts/tools/clickup.ts` (file exists, need implementation per plan)

## Phase 3: Agent Core

- [ ] Task 6: Write the system prompt in `scripts/prompts/system-prompt.md` (file exists, need implementation per plan)
- [ ] Task 7: Create curated sources file `scripts/sources.json` with all research sources from spec
- [ ] Task 8: Write the main agent script `scripts/weekly-agent.ts` (the core orchestrator using Claude Agent SDK)

## Phase 4: Transparency Data Generation

- [ ] Task 9: Write transparency data generator `scripts/generate-transparency.ts` that queries SQLite and outputs JSON to `data/generated/`

## Phase 5: Transparency Pages (in worktree)

- [ ] Task 10: Create transparency overview page `src/pages/transparency/index.astro` in the worktree
- [ ] Task 11: Create audit dashboard page `src/pages/transparency/audits.astro` with Chart.js in the worktree
- [ ] Task 12: Create intelligence dashboard page `src/pages/transparency/intelligence.astro` with Chart.js in the worktree

## Phase 6: GitHub Actions

- [ ] Task 13: Create weekly agent workflow `.github/workflows/weekly-agent.yml` (Sunday cron, runs agent, commits DB)

## Phase 7: Integration & Testing

- [ ] Task 14: Add navigation link to transparency pages in Header component (in worktree)
- [ ] Task 15: Add prebuild script for transparency data generation in `package.json`
- [ ] Task 16: Manual end-to-end test — run migration, run agent dry-run, verify transparency pages build
