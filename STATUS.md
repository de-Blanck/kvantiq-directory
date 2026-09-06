# STATUS — Kvantiq Directory

Session handoff document. Read at session start; update before ending. See
`CLAUDE.md` → "Context & Autonomy" for the rules that govern this file.

**Last updated:** 2026-09-06 (late evening)
**Branch:** `main`
**State:** Audit Dashboard rebuilt on real evidence; merging to `main` deploys and is verified against production; 0 open Dependabot alerts; Astro 7. **Two launchd agents now run unattended** — the weekly sweep and a merge-when-green job. **224 of 226 entries published.**

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

## What's done — 2026-09-06

- **Directory Growth chart fixed** — `/transparency/audit/` plotted a single point on the
  build date (`labels: ["2026-09-05"], values: [226]` in production) instead of the real
  five-step curve 183 → 226. `migrate-to-db.ts` derived `date_added` from `git log
  --diff-filter=A`, but `.vercelignore` excludes `.git`, so every lookup failed and every
  entry fell back to today. First-seen dates are now resolved once from git history and
  committed to `data/entry-first-seen.json`; git is consulted only for slugs the ledger has
  never seen, and a date never moves once written. `check-transparency-data.mjs` fails the
  build if the ledger is missing or the timeline collapses onto the build day. Verified in a
  git-less copy of the repo: correct timeline with the ledger, single point without it.

- **Guards against silent transparency-data loss** — the growth-chart bug passed every
  existing check because the files were present and non-empty. `check-transparency-data.mjs`
  now asserts the generated data against `src/content` instead: the first-seen ledger covers
  every entry, the timeline totals the real entry count, no date is the build day or in the
  future, and the confidence/coverage/audit totals match. It runs inside `prebuild`, so it
  runs on Vercel — a build that would ship wrong numbers fails instead. `npm run verify:live`
  (new) diffs the deployed pages against `dist/` after a production deploy.

- **Audit Dashboard rebuilt on evidence** (#127, #131). Five of six panels rendered a constant
  (`current_confidence`, written as the literal `'MEDIUM'` for all 226 entries at migration time)
  or nothing at all. The confidence score is retired rather than derived: entries carry the two
  facts a reader can check instead — how many credible sources they rest on, and when those were
  last read. The SQLite layer that existed only to launder content into those constants is gone
  (`migrate-to-db.ts`, `scripts/db/*`, the generator, `better-sqlite3`, seven dead artifacts).
  Panels now: source strength, verification freshness, news recency, completeness, source
  concentration, coverage, growth, held-back entries — each a tested pure function in
  `src/lib/audit-metrics.ts`.
- **Merging deploys** (2026-09-06). The Vercel project is connected to the repo; `npm run verify:live`
  compares each deployed page's rendered `<main>` against `dist/` and is run after every merge.
- **Sweep gained `--only`** (#130) for repairing entries without spending a rotation slice.

- **Dependency debt cleared** (#133, #135, #136). 58 open Dependabot alerts → **0**. 19 advisories
  closed inside existing ranges, then Astro 6 → 7.3.1 for the rest (`@astrojs/react` 5 → 6;
  sitemap and check needed no bump). `compressHTML` is pinned to `true`: v7 changed the default to
  `'jsx'`, which strips whitespace by JSX rules and would shift inline spacing site-wide. Adopting
  `'jsx'` is a separate change and needs its own screenshots.
- **`verify:live` covers twelve routes** (#129, #135). It compares each page's rendered `<main>`
  against `dist/`, with build noise separated from content and tested: island `uid`s and
  `data-astro-cid-*` hashes are regenerated per build (and per Astro version), and Astro's inlined
  hydration runtime is minified differently each time. Bundler chunk hashes are deliberately NOT
  normalised — a differing chunk name means production is running different JS, which is the point.
  Chart payloads are compared by name via `CHART_VARS`; add a name there when a page feeds a new chart.
  Astro 7 was verified this way: all twelve routes byte-identical to the Astro 6 site in production.

- **Automation, P1 + P2** (#138, #139). GitHub Actions cannot run here, so nothing gated a pull
  request and every merge needed a person. `npm run gate` (type-check, tests, build; `--live` adds
  `verify:live`, deliberately not in the default run because pre-merge the deployed site is still
  the previous build) and `scripts/auto-merge.mjs` close that: eligible PRs are gated, merged on
  green, then production is verified. **Eligible means** labelled `auto-merge` or from Dependabot,
  not draft, not conflicting, and touching nothing on `NEVER_AUTOMERGE` (`CLAUDE.md`, `.github/`,
  `scheduler/`, the automation's own scripts, `.env`, the ignore files). One merge per run; on
  production drift it opens an issue rather than reverting. **Kill switch:** create
  `.automation-paused` at the repo root — gitignored, its first line is the reason.
  Proven end to end on #139: gated, merged, deployed, verified, unattended.
- **The sweep no longer shares the checkout** (#138). It runs in `../.worktrees/sweep` with `.env`
  and `node_modules` symlinked — verified to type-check, test and build 206 pages there. Paired
  with a `block-git-during-job` hook in `claude-config` (`66f98f2`) that refuses `reset --hard`,
  forced checkout, `clean -f`, bare `stash` and `worktree remove` in a checkout where a job is
  running. Both halves exist because a `git reset --hard` destroyed ten entries' sweep work on
  2026-09-06.

## What's next / open

- **The autonomy tier policy is not written down yet.** Proposed 2026-09-06 and approved in
      conversation only: Tier 0 never (rulebook, force-push, secrets, deleting entries, lowering the
      source bar, account settings), Tier 1 autonomous (deps, docs, tests, sweep repairs, changes
      `verify:live` proves output-identical), Tier 2 autonomous with evidence (content clearing the
      3-source gate; panels built from existing components), Tier 3 Rune's (visual design, product
      direction). It belongs in `CLAUDE.md`, which is a rulebook change and needs Rune's explicit
      approval — which is exactly why `CLAUDE.md` is on the never-automerge list. Until then the
      auto-merge job only takes Dependabot PRs and ones labelled by hand.
- **16 open GitHub issues** have not been triaged in this work. Unblock: read them.

- **Next, and the only item here that makes the product more useful:** the directory has not
      grown since **2026-05-18** — the growth chart says so itself. `data/discovery-queue.json`
      holds five candidates from that date, four already at 3 credible sources: Arq Quantum
      Technologies (ES), Photarix (UK), Qinara (UK), CCRAFT (CH), and QDaria (NO, 2 sources —
      below the bar). Unblock: nothing. Just the content workflow in CLAUDE.md.
- **106 entries sit exactly at the 3-source bar** (47%), so a single retracted source would
      unpublish any of them. A backfill pass targeting a fourth credible source is the
      directory's largest structural fragility, and it is now measured on the audit dashboard.
- **Four entries never recovered their 2026-09-06 sweep updates** — `bosch-quantum-sensing`,
      `cubiq-technologies`, `peak-quantum`, `q-bird`. Their edits were destroyed by a
      `git reset --hard` in the shared checkout mid-run; the targeted re-run (`--only`) recovered
      six of ten, and these four returned no change on the second pass. The rotation will reach
      them normally. Unblock: nothing needed.
- **Protection Bypass for Automation is not configured** (Vercel → Project Settings → Deployment
      Protection). Until it is, `npm run verify:live` can only check production; preview
      deployments redirect to the Vercel SSO page, which the script reports as protection rather
      than as an empty page. Unblock: Rune enables it, then set
      `VERCEL_AUTOMATION_BYPASS_SECRET` in `.env`.
- **`compressHTML: 'jsx'`** — deferred deliberately (see above). Unblock: a PR that adopts it and
      shows before/after screenshots of a text-dense page.

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

**Merging to `main` deploys.** The Vercel project was connected to the GitHub repo on
2026-09-06 (`link: github de-Blanck/kvantiq-directory`, production branch `main`), so
production follows `main` on its own and pull requests get preview deployments. Before
that, production and `main` were joined only by someone remembering to run the CLI —
which is how the growth chart stayed wrong in production for months.

After a production deploy, confirm production renders what the build produced:

```
npm run verify:live
```

It diffs the chart data and the empty states of every `/transparency/` page against
`dist/`, and exits non-zero on any difference. Point it at a preview with
`LIVE_BASE_URL=…` (Deployment Protection redirects plain fetches to vercel.com; the
script says so rather than reporting an empty page).

**CLI fallback**, if the git integration is ever unavailable:

```
npm run build && vercel --prod --scope synapse-q && npm run verify:live
```

Run the CLI from the repo directory itself. `--cwd` is not enough: the CLI reads the
`.vercel` link of the shell's working directory, so running it from another repo
deploys this source against that project's framework preset and fails with a
misleading error (`No Next.js version detected`, 2026-09-06).

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
