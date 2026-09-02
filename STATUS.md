# STATUS — Kvantiq Directory

Session handoff document. Read at session start; update before ending. See
`CLAUDE.md` → "Context & Autonomy" for the rules that govern this file.

**Last updated:** 2026-09-02
**Branch:** `main` (4914547)
**State:** Backlog consolidated, full re-scan landed, 49 source contradictions resolved. **Deployed 2026-09-02 — the contradiction fixes are NOT yet live.**

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

Content accuracy pass 2026-09-02: 34 entries corrected. The worst were `q-ant`, whose
`website` pointed at an unrelated football-analytics platform; `portfolio-optimization`,
which asserted a positive quantum result from a paper concluding the opposite; and
`lih-ground-state`, which cited a paper benchmarking aluminium clusters rather than LiH.

## What's next / open

- [ ] **4 source contradictions left** — `docs/source-contradictions-2026-09-01.md`.
      49 of 53 resolved 2026-09-02 across PRs #91-#96 (34 corrected, 15 dismissed).
      The remainder: `diasense` and `xeedq` are **blocked** — their cited sources now
      return HTTP 404, so nothing live can arbitrate them and they need replacement
      sources. `bmbf-quantum-technologies` and `ibm-quantum-challenge` are **unverified**
      — no credible current source found, left flagged rather than guessed.
      Note for future sweeps: roughly a third of the cross-check flags were noise
      (LinkedIn-only counter-sources, objections to the schema's `type` enum, sources
      contradicting each other, and one flag that asserted the opposite of what the
      entry said). Treat the list as leads, not defects.
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
