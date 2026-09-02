# STATUS — Kvantiq Directory

Session handoff document. Read at session start; update before ending. See
`CLAUDE.md` → "Context & Autonomy" for the rules that govern this file.

**Last updated:** 2026-09-02
**Branch:** main (current, 46 commits ahead of 2026-07-26 session baseline)
**State:** Multiple PRs merged since last STATUS.md update; deploy status unknown

## What's done since 2026-06-28 (reconstructed from git log)
- **PR #73 merged (2026-09-02):** Automated weekly refresh — 7 entries updated (IQM Nasdaq/LUMI, Pasqal Q-PLANET, Quantinuum anyons/Rolls-Royce, Riverlane, Alice & Bob NVIDIA, EuroHPC Luxembourg, Qiskit v2.5). Heartbeat issue: #74.
- **Multiple subsequent PRs merged** (exact PR numbers not recorded here): 8 new company entries added (isentroniq, nvision-imaging, peak-quantum, qsensato, quantcore, quantum-fabrix, qutwo, zerothird), plus broad news/source updates across benchmarks, resources, and companies. Source contradictions documented in `docs/source-contradictions-2026-09-01.md`.

## Content snapshot (filesystem = source of truth)
Run `npm run audit:content` and `npm run audit:sources` for current counts — do NOT trust numbers written here.

## What's next / open
- [ ] **Deploy** current main to prod: `vercel --prod` (no auto-deploy). Run `git log --oneline origin/main` to count undeployed PRs.
- [ ] **Fix quantinuum sources**: Wikipedia entry still in sources array (not credible). Added TQI/QCR/Nature in #73 but old Wikipedia entry remains. Manual cleanup needed.
- [ ] **Fix riverlane sources**: Pre-#73 sources were all riverlane.com (1 effective credible source). TQI+QCR added in #73; old entries remain. Manual cleanup.
- [ ] **Source-bar stragglers**: Run `npm run audit:sources` for the current below-bar list. As of 2026-06-28 there were 14; the 2026-08-31 full scan likely reduced this further.
- [ ] **No Zod `.min(3)` flip yet** — check `audit:sources --strict --collection <name>` per collection before flipping.

## Parked (decision pending, not started)
- **Industry-intelligence subpage** (`/transparency/intelligence/`, a stub). Built for funding-events + market-snapshots data we don't hold structured. **Decision (Rune, 2026-06-28): strip the two unpopulatable sections (Funding Timeline, Recent Events), repoint Market Snapshot to the 3 KPIs derivable from existing content (Total Tracked, Countries, Active).** Own branch + plan + sign-off when picked up. Funding-events curation = separate later workstream.

## Reference
- Backfill tooling details + the 14-entry ceiling: memory `project-source-backfill-tooling`.
