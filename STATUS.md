# STATUS — Kvantiq Directory

Session handoff document. Read at session start; update before ending. See
`CLAUDE.md` → "Context & Autonomy" for the rules that govern this file.

**Last updated:** 2026-06-28
**Branch:** docs/context-autonomy-section (this change); main is the baseline
**State:** Content live; source-backfill workstream in progress

## What's done
- Weekly AI sweep + 76-source backfill landed on main (commit `46716e1`, 2026-06-24).
- `audit:sources` tool + 3-credible-source rule and cross-check gate in place.

## Content snapshot (filesystem = source of truth)
| Collection | Entries |
|-----------|---------|
| companies | 102 |
| benchmarks | 39 |
| use-cases | 23 |
| challenges | 12 |
| resources | 42 |
| **Total** | **218** |

**Source-backfill bar (3 credible sources):** 96 at/above, 122 below (56%) as of
2026-06-28. Zod stays at `.min(2)` per collection until that collection clears
`npm run audit:sources --strict --collection <name>`.

## What's next
- [ ] Triage 9 stale auto-refresh PRs (oldest 2026-05-10, newest #62 2026-06-21) — most superseded by merged sweeps.
- [ ] Backfill `resources` (42 entries, all at 2/2) over the bar, then flip its Zod min to `.min(3)`.
- [ ] Deploy current main: sweep (optional) → `vercel --prod`, both redirected to logs. Last deploy 2026-06-25 (no auto-deploy).

## Notes
- Site does NOT auto-deploy; new content reaches production only via manual `vercel --prod`.
- 7 stale "Automated directory refresh status" issues open (automation reports) — close alongside PR triage.
