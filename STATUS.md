# STATUS — Kvantiq Directory

Session handoff document. Read at session start; update before ending. See
`CLAUDE.md` → "Context & Autonomy" for the rules that govern this file.

**Last updated:** 2026-09-02
**Branch:** `main` (4914547)
**State:** Backlog consolidated, full re-scan landed, **deployed to production**

## What's done (2026-08-31 → 2026-09-02 session)

- **17 unmerged auto-refresh PRs consolidated** (#85, spanning 2026-05-10 → 2026-08-30).
  The weekly bot had kept running since May; nothing had been merged since June, so
  `main`'s newest news item was dated 2026-06. Merged oldest → newest with a JSON-aware
  3-way merge: `news`/`sources`/`products` unioned and deduped by URL, scalars newest-wins.
  Verified 0 of 845 URLs lost. All 17 now show as MERGED.
- **Two data-loss bugs in the sweep fixed.** `ai-sweep.mjs` rewrote each entry's news as
  the newest 5 items under 180 days old, so every run silently destroyed sourced history
  — 78 items would have been cut by the cap (#86) and 176 by the age prune. This is why
  every weekly PR stayed small: the bot was overwriting itself.
- **Sweep resilience** (#87). A network drop at entry 28 of a 226-entry run made every
  later entry record "all fetches failed" and the run continued for 110 more minutes
  producing nothing. Now retries transient fetches and aborts after 8 consecutive
  total failures.
- **Full re-scan** (#88) — 226 scanned, 46 updated, 59 news items, 4 skipped on isolated
  `claude -p` timeouts. Methodology pass-rate 98.4%.
- **Analytics fixed** (#89). The Plausible tag had been shipping since 2026-05-08 to a
  site never registered on any Plausible account — four months uncounted. Replaced with
  Vercel Web Analytics (included in the Pro plan both teams have); placeholder GSC/Bing
  verification metas removed.
- **Deployed to production 2026-09-02** — first deploy since 2026-06-25. Verified live:
  IQM's page serves post-IPO data, `/_vercel/insights/script.js` present.

## Content snapshot (filesystem = source of truth)

226 entries · 463 news items · **211 at/above** the 3-credible bar · **15 below (7%)**.

## What's next / open

- [ ] **53 source contradictions** — `docs/source-contradictions-2026-09-01.md`. Entries whose
      own sources disagree, mostly founding years, funding totals, headquarters cities.
      No automated pass can fix these: `ai-sweep.mjs` writes only `news` and `sources`.
      This is the highest-value content work on the board.
- [ ] **15 entries below the source bar** — the 14 long-standing ones plus `nvision-imaging`
      (new, from a sweep). No discoverable 3rd independent credible source; manual sourcing
      or accept-as-is. Not a tooling gap.
- [ ] **No Zod `.min(3)` flip yet** — no collection fully clears `audit:sources --strict --collection <name>`.
- [ ] **PR #46** (`chore(agents): every-5-days cadence`) — still open, obsolete as written:
      it patches three `.github/workflows/*` files deleted from `main` by `b88d6f6`.
      Needs a decision, not a merge.
- [ ] **Vercel CLI is 54.2.0**, remote builder runs 59.3.0. The skew caused a failed deploy:
      the CLI auto-detects the framework from the *process* cwd, not `--cwd`, and stamped
      `framework: "nextjs"` on this Astro project. Deploy from inside the repo directory.

## Deploy

No Git integration on the Vercel project (`link: NONE`) — merging to `main` deploys nothing.
Production is CLI-only and manual, run from inside the repo:

```
vercel --prod --scope synapse-q
```

Project: `feature-directory-site` on the `synapse-q` team → `directory.kvantiq.studio`.

## Parked (decision pending, not started)

- **Industry-intelligence subpage** (`/transparency/intelligence/`, a stub). Built for
  funding-events + market-snapshots data we don't hold structured. **Decision (Rune,
  2026-06-28): strip the two unpopulatable sections (Funding Timeline, Recent Events),
  repoint Market Snapshot to the 3 KPIs derivable from existing content (Total Tracked,
  Countries, Active).** Own branch + plan + sign-off when picked up. Funding-events
  curation = separate later workstream.

## Reference

- Backfill tooling details and the under-bar ceiling: memory `project-source-backfill-tooling`.
- Contradiction worklist: `docs/source-contradictions-2026-09-01.md`.
