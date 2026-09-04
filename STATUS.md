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
- **Rulebook updated** (PRs #102, #107) — CLAUDE.md records the publish gate, the
  corrected below-bar count, and which collection sits at which schema floor.
- **Schema backstop** (PR #107) — `.min(3)` on the four cleared collections, verified
  by a negative test (dropping a source fails the build) rather than by the passing
  case alone.

## Content snapshot (filesystem = source of truth)

226 entries · 463 news items · **224 at/above** the 3-credible bar · **2 below (1%)**.

The 8 below the bar are **withheld from the published site** (excluded from listings,
sitemap and search, served noindex, listed on `/transparency/audit/`). See CLAUDE.md →
"Credible-source counting and the backfill bar".

Content accuracy pass 2026-09-02: 34 entries corrected. The worst were `q-ant`, whose
`website` pointed at an unrelated football-analytics platform; `portfolio-optimization`,
which asserted a positive quantum result from a paper concluding the opposite; and
`lih-ground-state`, which cited a paper benchmarking aluminium clusters rather than LiH.

## What's done — 2026-09-04

- **Industry Intelligence rebuilt** (PR #109) — the page was live, linked and sitemapped while
  rendering four em-dashes and "No events recorded yet". It read three files from
  `data/generated/` that are empty and that the generator produces empty (the DB has no
  funding/event rows). Now derived from `getCollection` through `publishedOnly`, so it cannot
  silently empty itself. Funding totals and the event feed are absent rather than stubbed,
  with a note on the page saying why.
- **Deploy path made reproducible** (PR #110) — the Vercel CLI does not read `.gitignore`.
  With no `.vercelignore` it uploaded the whole working directory: 10.6 MB / 1007 files,
  including `.env` with a live OAuth token, the SQLite db and three scratch dirs. Confirmed
  against the deployment file listing. After the fix: **35 KB / 334 files, no secrets**.
  `data/generated/sweep-runs.json` is now tracked — it is appended by `ai-sweep.mjs` and no
  build can reconstruct it. `scripts/check-transparency-data.mjs` fails the build when a file
  a transparency page reads is missing or empty.
- **Public metadata made consistent** (PR #111) — every count, date and scope claim now
  derives from the data. Removed a five-month-stale hardcoded date, "150+ companies" sitting
  above a rendered 110, two unsourced figures, the "no open European directory exists" claim,
  and "across Nordics and DACH" in five places. `public/llms.txt` became a generated route.

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
- [x] **Zod `.min(3)` flip — done for the four cleared collections** (PR #107).
      Companies, benchmarks, use-cases and resources enforce a floor of 3 at build
      time. **Challenges stays at `.min(2)`** and should stay there until the two
      withheld entries above either gain a third source or are removed — raising it
      would turn an intentionally unpublished entry into a build failure.
      The schema is a backstop, not the gate: it counts raw sources, while
      `src/lib/source-bar.ts` counts credible ones and is still what decides what ships.
- [x] **Claude Code OAuth token rotated** (2026-09-04). The old one had been uploaded to
      Vercel on every CLI deploy before `.vercelignore` existed (deployment
      `dpl_6Hd41Fw3GgyU3G8mHrNG9Z3MVfMp` and earlier). New token written to `.env` (mode 600,
      gitignored, vercelignored) and verified against the `claude` CLI. Worth confirming the
      old token is revoked in Claude account settings — not verified from here.
- **TypeScript is pinned to `^6` deliberately — not an open item.** `astro check` needs the
      programmatic compiler API that TypeScript 7.x's native port does not expose, and
      `@astrojs/check` is still at 0.9.10 (checked 2026-09-04). The only alternative is
      dropping `astro check` for `tsc --noEmit`, which would stop type-checking `.astro`
      files — most of this codebase — to buy a cosmetic version bump. The pin costs nothing:
      0 errors, 0 warnings. Revisit only if `@astrojs/check` ships 7.x support.

## Sweep schedule

Installed 2026-09-04 on this Mac: launchd agent **`com.kvantiq.directory.weekly`**,
Sundays 03:00 local, missed runs fire at next wake.

```
plist   ~/Library/LaunchAgents/com.kvantiq.directory.weekly.plist
log     scheduled-run-debug.log (repo root, gitignored)
run now launchctl start com.kvantiq.directory.weekly
remove  launchctl unload <plist> && rm <plist>
```

It runs `scripts/scheduled-run.mjs`, which bills against the Max subscription through the
`claude` CLI — no GitHub Actions, no API key. It validates the build before pushing and
**opens a PR without merging**. Preflight verified 2026-09-04: `gh` authenticated, `claude`
on PATH, rotated token accepted.

**Failure reporting.** A completed sweep always appends a run record to the tracked
`sweep-runs.json`, so a finished run always produces a PR. A run that dies before that used
to produce nothing at all — which made "no PR" indistinguishable from "ran fine, nothing
changed". Since 2026-09-04 every fatal path files a GitHub issue (`Weekly sweep failed — …`)
with the reason and the tail of the run log, deduped so a machine that stays broken files one
issue rather than one a week. Close the issue once fixed, or the next failure is suppressed.
Verified end-to-end by forcing a preflight failure in a throwaway clone (issue #114, closed).

**Residual gap:** if launchd never fires at all — machine off or asleep through Sunday 03:00,
agent unloaded — nothing runs, so nothing reports. That cannot be detected from inside the
script; it needs an external heartbeat, which we have not built. In practice a missing PR two
weeks running is the signal.

**Node path.** The plist hardcodes `~/.nvm/versions/node/v24.15.0/bin/node`. This is less
fragile than it looks: nvm keeps old versions on disk, so installing a newer node does not
break the schedule — the job simply keeps running on 24.15.0. It breaks only on an explicit
`nvm uninstall`, an nvm cleanup, or a new machine. Re-run `scheduler/install-macos.sh` then.

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
