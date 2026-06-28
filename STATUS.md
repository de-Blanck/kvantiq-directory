# STATUS — Kvantiq Directory

Session handoff document. Read at session start; update before ending. See
`CLAUDE.md` → "Context & Autonomy" for the rules that govern this file.

**Last updated:** 2026-06-28
**Branch:** main is baseline; `docs/context-autonomy-section` (PR #64) holds this file + CLAUDE.md section
**State:** Source-backfill workstream landed; content live but NOT deployed

## What's done (2026-06-28 session)
- Autonomous source-backfill run (`ai-sweep.mjs --backfill-sources`, ~3h21m) → **PR #65 merged**.
- Targeted re-backfill of stragglers (reused exported discovery/validation fns) → **PR #66 merged**.
- Source-bar: below the 3-credible bar **122 → 14** (56% → 6%). 275+8 credible URLs added.
- Encoded the autonomous-run pattern: global `~/.claude/CLAUDE.md` (pushed) + this repo's "Context & Autonomy" section (**PR #64, OPEN**).

## Content snapshot (filesystem = source of truth)
218 entries · **204 at/above** the 3-credible bar · **14 below (6%)**.

## What's next / open
- [ ] **Merge PR #64** (docs Context & Autonomy + this STATUS.md). Until merged, STATUS.md is not on main.
- [ ] **Deploy** current main to prod: `vercel --prod` (no auto-deploy). Last deploy 2026-06-25. Two content PRs (#65, #66) merged but NOT yet published.
- [ ] **14 entries still below bar** — abstract benchmarks (shor-factoring, h2o-molecule, lih-ground-state, grover-search-scaling, transverse-field-ising, dwave-spin-glass-dynamics, quantum-centric-chemistry-ibm-heron), use-cases (aircraft-loading-optimization, catalyst-design-green-hydrogen, production-scheduling), challenges (qhack-2025, quantum-game-jam-2025, wacqt-quantum-hackathon-2026), resources (quantum-amsterdam). No discoverable 3rd independent credible source — manual sourcing or accept-as-is. Not a tooling gap.
- [ ] **No Zod `.min(3)` flip yet** — no collection fully clears `audit:sources --strict --collection <name>`.

## Parked (decision pending, not started)
- **Industry-intelligence subpage** (`/transparency/intelligence/`, a stub). Built for funding-events + market-snapshots data we don't hold structured. **Decision (Rune, 2026-06-28): strip the two unpopulatable sections (Funding Timeline, Recent Events), repoint Market Snapshot to the 3 KPIs derivable from existing content (Total Tracked, Countries, Active).** Own branch + plan + sign-off when picked up. Funding-events curation = separate later workstream.

## Reference
- Backfill tooling details + the 14-entry ceiling: memory `project-source-backfill-tooling`.
