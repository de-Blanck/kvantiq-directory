# STATUS — Kvantiq Directory

Session handoff document. Read at session start; update before ending. See
`CLAUDE.md` → "Context & Autonomy" for the rules that govern this file.

**Last updated:** 2026-09-03
**Branch:** `main`
**State:** All source contradictions closed, publish gate live, type checking in place. **224 of 226 entries published.**

## What's done — 2026-08-31 → 2026-09-02

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

## What's done — 2026-09-02 → 2026-09-03

- **All 53 source contradictions closed** (PRs #91–#96, #98) — 38 corrected, 15 dismissed.
  Roughly a third of the sweep's flags were noise; one asserted the opposite of what the
  entry said. Treat the cross-check output as leads, not defects.
- **Publish gate** (PR #99) — entries below the 3-credible-source bar are withheld from
  listings, sitemap and search and served noindex, but keep their URLs so nothing indexed
  404s. Listed publicly on `/transparency/audit/`.
- **Type checking** (PR #101) — the repo had none. `astro check` was exiting 0 by prompting
  to install TypeScript and never running. Now `npm run type-check`, TypeScript pinned to
  `^6`. It found 16 errors, two of them introduced by #99 the same day.
- **13 of 15 under-bar entries sourced back above the bar** (PRs #103, #105, #106) — 15 → 2 below.
  The 2026-06-28 note claiming no third source was discoverable was wrong 13 times out of 15.
- **Country-page 404 fixed** (PR #100) — every UK company page had linked to a dead URL
  since 2026-03-19.
- **Rulebook updated** (PR #102) — CLAUDE.md now records the publish gate.

## Content snapshot (filesystem = source of truth)

226 entries · 463 news items · **224 at/above** the 3-credible bar · **2 below (1%)**.

The 8 below the bar are **withheld from the published site** (excluded from listings,
sitemap and search, served noindex, listed on `/transparency/audit/`). See CLAUDE.md →
"Credible-source counting and the backfill bar".

Content accuracy pass 2026-09-02: 34 entries corrected. The worst were `q-ant`, whose
`website` pointed at an unrelated football-analytics platform; `portfolio-optimization`,
which asserted a positive quantum result from a paper concluding the opposite; and
`lih-ground-state`, which cited a paper benchmarking aluminium clusters rather than LiH.

## What's next / open

- [x] **Source-bar backfill complete — 13 of 15 recovered.** 224 of 226 entries published.
      Two remain unpublished and are assessed as **genuinely unsourceable**, not pending:
      - `challenges/qhack-2025` — both existing sources (`qhack.ai`, `github.com/XanaduAI/QHack`)
        are Xanadu's own. No independent coverage of the **2025** edition exists; trade press
        covered 2023 and 2024, and the only QHack-2025 hit is a press release republished on
        HPCwire's off-the-wire section, which the rulebook counts as the same source as the
        release.
      - `challenges/quantum-game-jam-2025` — Aalto and IGDA material covers the jam **series**,
        not the 2025 edition. Nothing found substantiates "11th edition" or the September dates.
      Both are correctly withheld: one-off community events with no independent reporting.
      Revisit only if coverage appears; do not pad with organizer-controlled sources.
- [ ] **Zod `.min(3)` flip** — still pending per collection. Now tidiness rather
      than safety: the publish gate keeps under-sourced entries off the site
      regardless of what the schema allows.
- [ ] **Unpin TypeScript** from `^6` once `astro check` supports the 7.x native
      compiler (withastro/roadmap#1321).

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
