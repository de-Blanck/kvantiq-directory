# Scheduled Runner (portable, no GitHub Actions)

Two launchd agents, both installed by `scheduler/install-macos.sh`:

| Agent | Runs | When |
|---|---|---|
| `com.kvantiq.directory.weekly` | `scripts/scheduled-run.mjs` — the AI content sweep | Sundays 03:00 |
| `com.kvantiq.directory.automerge` | `scripts/auto-merge.mjs` — gate and merge eligible PRs | every 2 hours |

Pause both at once by creating `.automation-paused` at the repo root; its first
line is echoed as the reason. The file is gitignored, so pausing on this machine
does not propagate to anyone else.

The weekly **AI content sweep** runs from any machine you control — Intel Mac,
Apple-Silicon Mac, or Windows — on a local schedule. The Claude work bills
against your **Max subscription** through the `claude` CLI. There is no GitHub
Actions compute and no Anthropic API key.

This replaces `.github/workflows/ai-sweep.yml`. The workflow file is left in
place but its schedule should be disabled (see "Avoiding duplicates").

## What runs

`scripts/scheduled-run.mjs` (one cross-platform Node entrypoint):

1. Preflight — checks `git`, `npm`, `gh` (authenticated), the `claude` CLI, and
   the subscription token.
2. Prepares a dedicated **worktree** at `../.worktrees/sweep`, reset to
   `origin`'s default branch, with `.env` and `node_modules` symlinked from the
   main checkout. Everything after this step runs there.

   The sweep used to run in the main working copy — the same one a person or a
   Claude session uses — and it begins by resetting that copy hard. On
   2026-09-06 the reverse happened: a session's `git reset --hard` destroyed the
   updates the sweep had already written to ten entries, and the sweep's own
   `git add -A` then swallowed an unrelated uncommitted edit into its commit.
   The worktree removes the shared surface; a guard hook in `claude-config`
   refuses destructive git in a checkout where a job is running.
3. **Dedup guard** — if an open `ai-sweep/weekly*` PR already exists, it exits.
   So if two machines are on at the scheduled time, you still get **one** PR.
4. `npm ci`.
5. Runs `scripts/ai-sweep.mjs` — refreshes each entry's news strictly from
   fetched source pages (never fabricated).
6. If nothing changed, exits cleanly.
7. `npm run build` to validate — a broken build never becomes a PR.
8. Runs `npm run verify:live` and, if production does not match this build,
   quotes the findings into the PR body under a review checkbox. Never fatal.
9. Branches `ai-sweep/weekly-YYYY-MM-DD`, commits, pushes, opens a PR. **Never
   merges** — you review. Content is Tier 2: a green build cannot vouch for it.

## What the auto-merge agent runs

`scripts/auto-merge.mjs`, every two hours. GitHub Actions cannot run on this
repo, so no status check gates a pull request; this runs the same gate a person
would run and merges only what is provably safe.

1. Stops immediately if `.automation-paused` exists.
2. Lists open PRs and decides eligibility: labelled `auto-merge` or authored by
   Dependabot, not draft, not conflicting, and touching nothing on
   `NEVER_AUTOMERGE` — the rulebook, `.github/`, `scheduler/`, the automation's
   own scripts, `.env`, the ignore files. Everything else waits for review.
3. One PR per run. Checks it out, installs, runs `npm run gate` (type-check,
   tests, build). On failure it comments the failing step and leaves the PR open.
4. On green: merges, waits for the deploy, then runs `npm run verify:live`. If
   production disagrees with the build it **opens an issue rather than
   reverting** — reverting is a judgement call, and the deploy may still be in
   flight.

```bash
node scripts/auto-merge.mjs --dry-run   # decide and explain, change nothing
npm run gate                            # the same gate, by hand
npm run gate -- --live                  # adds verify:live, for after a deploy
```

## Per-machine prerequisites

Each machine that should be able to run it needs:

- **Node 22+**, **git**, **npm**
- **GitHub CLI** authenticated: `gh auth login` (needs push + PR rights on the repo)
- **An HTTPS `origin`, not SSH.** A scheduled job runs without your SSH agent, so an
  `git@github.com:` remote fails with `Permission denied (publickey)` even though it
  works perfectly in your terminal. This bit us on 2026-09-04: the key on that Mac lives
  in a password-manager SSH agent with no private key on disk at all, so no amount of
  `~/.ssh/config` would have helped. Point git at `gh`'s token instead — it is in the
  system keyring and does work headlessly:

  ```bash
  gh auth setup-git
  git remote set-url origin https://github.com/<owner>/<repo>.git
  ```

  Verify it works the way the scheduler will see it, with the agent hidden:

  ```bash
  env -u SSH_AUTH_SOCK git fetch origin --prune
  env -u SSH_AUTH_SOCK git push --dry-run origin main
  ```

  The same applies to **commit signing**, and it bites later — after the sweep has
  already spent an hour. If `commit.gpgsign` is on with `gpg.format=ssh`, the commit
  needs the same agent the fetch did. The runner therefore commits with
  `-c commit.gpgsign=false`; its commits are vouched for by the PR review rather than
  by whose key happened to be loaded on the machine that ran it. Nothing to configure,
  but worth knowing why those commits are unsigned.
- **Claude CLI** on `PATH` (the same `claude` you use interactively)
- **A clone of this repo**
- **The subscription token** — generate once with `claude setup-token`, then put
  it in a repo-root `.env` (gitignored):

  ```
  CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
  ```

  The runner also reads the variable straight from the environment if you'd
  rather export it there.

## Install the schedule

Both installers schedule **Sundays 03:00 local** and catch missed runs when the
machine next wakes.

**macOS (Intel or Apple Silicon):**

```bash
scheduler/install-macos.sh
launchctl start com.kvantiq.directory.weekly   # optional: run once now to test
```

**Windows (PowerShell):**

```powershell
powershell -ExecutionPolicy Bypass -File scheduler\install-windows.ps1
Start-ScheduledTask -TaskName KvantiqDirectoryWeekly   # optional: run once now to test
```

## Test without installing

Run the whole thing by hand from the repo root:

```bash
node scripts/scheduled-run.mjs
```

It will sync, sweep, build, and open a PR if there are changes. Watch progress in
the console or in `scheduled-run-debug.log` (gitignored).

## Avoiding duplicates

Two layers of protection let multiple machines coexist safely:

- The **dedup guard** skips the run if this week's sweep PR is already open.
- You should still **disable the GitHub Actions schedule** so it doesn't also
  open PRs once its billing is restored — comment out (or delete) the `schedule:`
  trigger in `.github/workflows/ai-sweep.yml`.

If you put the schedule on **multiple** machines, that's fine — whichever wakes
first does the work; the others see the open PR and skip.

## Troubleshooting

- **`CLAUDE_CODE_OAUTH_TOKEN is not set`** — add it to `.env` or the environment.
  Rotate with `claude setup-token` (tokens are long-lived but not permanent).
- **`gh is not authenticated`** — run `gh auth login`.
- **macOS job didn't fire** — the Mac was off/asleep at 03:00 Sunday; launchd
  runs it at the next wake. Force a run: `launchctl start com.kvantiq.directory.weekly`.
- **Windows task didn't fire** — confirm under Task Scheduler; the task runs as
  your user, so it needs you logged in (or stored credentials). Force a run:
  `Start-ScheduledTask -TaskName KvantiqDirectoryWeekly`.
- **Partial run** — if the sweep times out, crashes, or exhausts the subscription
  pool partway, the runner still builds and opens a PR with the entries it *did*
  process, titled `content: weekly AI content sweep (partial)` with a ⚠️ banner.
  Just review/merge it, or close it and re-run `node scripts/scheduled-run.mjs` to
  refresh from scratch. (If the sweep fails *and* produced no changes, the run
  exits non-zero with nothing to PR — check the log.)
- **Logs** — every run appends to `scheduled-run-debug.log` at the repo root.
