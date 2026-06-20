# Cloud-Agent Migration (Claude scheduled agents)

Plan to move the directory's weekly automation off **GitHub Actions** and onto
**Claude scheduled cloud agents** ("co-work") running on the Max subscription —
no GitHub Actions compute, no pay-per-token API key.

Status: **planned, not yet executed.** PoC scoped to `ai-sweep` first.
Author context: drafted 2026-06-20 while the GitHub Actions pipeline was
billing-blocked (see "Why" below).

## Why migrate

Two distinct failures hit the pipeline, in order:

1. **2026-05-10 — Anthropic credit cliff.** Workflows used `ANTHROPIC_API_KEY`
   (pay-per-token) and died with `Credit balance is too low`. Fixed by migrating
   to subscription auth (`CLAUDE_CODE_OAUTH_TOKEN`) on 2026-05-18. See
   [`ci-oauth-setup.md`](./ci-oauth-setup.md).
2. **2026-05-31 onward — GitHub Actions compute billing block.** *Every* workflow
   on this private repo now fails in ~3–5 seconds with **zero steps executed**.
   The GitHub run annotation is explicit:

   > "The job was not started because recent account payments have failed or your
   > spending limit needs to be increased. Please check the 'Billing & plans'
   > section in your settings."

   This is **GitHub's** compute billing — separate from Anthropic. The Claude side
   is already on the subscription and costs nothing extra; the blocker is the cost
   of the Ubuntu runner minutes. Last fully-successful agent run: 2026-05-24.

The migration removes the dependency on GitHub Actions compute entirely. The cron
and the runner move to Anthropic's cloud, billed against the Max subscription.

## Alternatives considered (not chosen)

- **Make the repo public** → free unlimited GitHub Actions. Rejected for now;
  keeps source private.
- **Fix GitHub billing, keep workflows as-is** → smallest change, but keeps paying
  GitHub for runner minutes. Rejected per preference to consolidate on the Max plan.

## Open questions (resolve at setup)

1. **Billing surface — the gating unknown.** `ci-oauth-setup.md` notes the CLI is
   "the only subscription-billed surface" and the Agent SDK is excluded from
   subscription billing. It is **not yet confirmed** that a Claude *scheduled cloud
   agent* draws from the Max subscription's programmatic pool. **Verify before
   trusting the migration for the heavy weekly-agent.** If cloud routines bill
   differently, the economics change.
2. **Execution shape.** A cloud agent *is* Claude. It can either:
   - (a) run the existing `node scripts/ai-sweep.mjs`, which shells out to a nested
     `claude -p` subprocess (needs the `claude` CLI + token in the routine env), or
   - (b) do the extraction natively (the agent fetches sources and extracts news
     itself with the same anti-fabrication rules), skipping the nested CLI.
   Prefer (b) if the routine can't cleanly run a nested CLI; prefer (a) to reuse the
   battle-tested deterministic JS (HTML strip, domain validation, dedup).
3. **Repo write access.** The routine needs to push a branch and open a PR on
   `de-Blanck/kvantiq-directory`. Confirm the cloud agent's GitHub auth covers this.
4. **Secrets (weekly-agent only, not PoC).** The heavy agent needs `RESEND_API_KEY`,
   `CLICKUP_API_TOKEN`, `CLICKUP_LIST_ID` for its custom MCP server. Whether a
   scheduled routine can hold repo secrets + launch a repo-defined MCP server is
   unconfirmed. **Does not apply to the ai-sweep PoC** (see below).

## Phase 1 — PoC: `ai-sweep` (chosen first)

`ai-sweep` is the right proof-of-concept because it has **none** of the risky
dependencies: no SQLite, no custom MCP server, no Resend, no ClickUp. It needs only
the repo, Node, the `claude` CLI, and the subscription token.

What it does (`scripts/ai-sweep.mjs`): walks every entry JSON in
`src/content/{companies,benchmarks,use-cases,challenges,resources}`, fetches each
entry's `sources[].url` + `website`, strips HTML, and asks Claude (Haiku,
subscription auth) to extract **only** news explicitly present in the fetched text.
Hard anti-fabrication gate: a news item's domain must match a fetched source domain.
Writes back up to 5 news items per entry (180-day freshness), then the workflow runs
`npm run build` and opens a PR.

### Proposed routine

| Field | Value |
|---|---|
| Name | `Kvantiq Directory · AI content sweep` |
| Platform | Claude scheduled cloud agent (Max plan) |
| Repo | `de-Blanck/kvantiq-directory` |
| Schedule | Weekly, Sunday 00:00 UTC (matches `ai-sweep.yml` cron `0 0 * * 0`) |
| Task | Run the content sweep (logic of `scripts/ai-sweep.mjs`), `npm run build` to validate, open PR on branch `ai-sweep/weekly` titled `content: weekly AI content sweep` |
| Merge policy | **Never auto-merge.** Human reviews the PR. |

### PoC task prompt (draft)

> On the `de-Blanck/kvantiq-directory` repo, run the weekly AI content sweep.
> For each entry JSON under `src/content/{companies,benchmarks,use-cases,challenges,resources}`,
> fetch its source URLs and website, and extract ONLY news items explicitly stated
> in the fetched content — never from memory. A news item's URL domain must match a
> fetched source domain. Keep at most 5 news items per entry, dropping items older
> than 180 days, and dedupe by URL. Write changes back to the JSON files. Then run
> `npm run build` to validate. If there are changes, open a PR on branch
> `ai-sweep/weekly` titled `content: weekly AI content sweep` with a review
> checklist. Do NOT merge.

### Success criteria

- Routine runs on schedule on the Max plan (no GitHub Actions minutes consumed).
- A PR appears on `ai-sweep/weekly` with only source-grounded news changes.
- `npm run build` passes.
- Confirmed: the run billed against the subscription pool (resolves Open Q1).

## Phase 2 — full parity: `weekly-agent` (after PoC validates)

Only attempt once the PoC confirms the billing surface and repo-write access. Adds:

- The stateful research agent (`scripts/weekly-agent.ts` prompt build, SQLite via
  `migrate-to-db.ts`, `generate-transparency-data.ts`).
- The custom MCP server (`scripts/tools/mcp-server.ts`) for **Resend email digest**
  and **ClickUp flagging** — gated on Open Q4.
- If the routine can't host the MCP server + secrets: degrade gracefully — keep the
  PR (core value), drop email/ClickUp, or relocate notifications.

## Rollback / fallback

The GitHub Actions workflows are **not deleted** — they remain in
`.github/workflows/` and resume working the instant the GitHub billing block is
cleared. The cloud routine and the Actions workflows can coexist; disable one
trigger to avoid duplicate PRs once the chosen path is validated.

## Setup steps (once the cloud-scheduling backend is reachable)

1. Create the routine per the table above (`/schedule`).
2. Resolve Open Q2 (execution shape) against the routine environment.
3. Manually trigger one run; confirm the PR + `npm run build` pass.
4. Confirm billing surface (Open Q1) via https://console.anthropic.com/settings/usage.
5. Disable the `ai-sweep.yml` schedule trigger (keep the file) to avoid duplicate PRs.
6. If green for 2 weeks, proceed to Phase 2.
