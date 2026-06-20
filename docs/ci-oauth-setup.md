# CI OAuth Token Setup

The kvantiq-directory CI workflows (`weekly-agent.yml`, `ai-sweep.yml`) authenticate to Claude Code via a long-lived OAuth token that bills against the **subscription programmatic credit pool** instead of pay-per-token API credits.

This page is the one-time setup. It takes ~5 minutes.

## What changed and why

Before the migration, both workflows used `ANTHROPIC_API_KEY` and were billed per token through the Anthropic API. On 2026-05-10 the weekly-agent run died mid-flight with `Credit balance is too low`, and the ai-sweep run silently produced content it couldn't push (a separate permissions bug). Switching to subscription auth means the work is paid for by your existing Pro/Max subscription's programmatic pool — no separate API account, no credit cliff.

## One-time setup

### 1. Generate an OAuth token locally

On a machine where you're already logged into Claude Code (i.e. `claude` works without prompting for a key):

```bash
claude setup-token
```

This prints a long-lived OAuth token. Copy it — you won't see it again.

### 2. Add it as a GitHub secret

Repository: `de-Blanck/kvantiq-directory`

- Settings → Secrets and variables → Actions → New repository secret
- Name: `CLAUDE_CODE_OAUTH_TOKEN`
- Value: paste the token from step 1

### 3. (Optional) Remove the now-unused API key

Once the new workflows are confirmed working, you can delete the `ANTHROPIC_API_KEY` repo secret. Nothing in this repo references it anymore.

The OpenAI, Perplexity, and Google API keys are no longer needed either — the citation-probe that used them has been removed.

### 4. Verify

Trigger a manual run to confirm auth works without waiting for Sunday's cron:

```bash
gh workflow run weekly-agent.yml --repo de-Blanck/kvantiq-directory --ref main
gh workflow run ai-sweep.yml --repo de-Blanck/kvantiq-directory --ref main
```

Watch the runs at https://github.com/de-Blanck/kvantiq-directory/actions. The first action step should authenticate cleanly; no "Credit balance is too low" or 401 errors.

## Token rotation

The OAuth token is long-lived but not permanent. Anthropic doesn't publish a fixed expiry, so the practical rotation policy is:

- **Rotate proactively** every ~6 months
- **Rotate immediately** if you suspect compromise or if a workflow run fails with 401
- **Rotate** if you switch Claude subscription tiers

To rotate: re-run `claude setup-token`, update the GH secret, run the workflow_dispatch verification.

## Budget visibility

The subscription's programmatic credit pool is separate from your interactive (terminal) usage. Track both at https://console.anthropic.com/settings/usage — the dashboard shows the programmatic pool's consumption and reset date.

If a weekly run starts dropping work because the pool is exhausted, the symptoms are the same as the old "credit balance" error. Mitigations:

1. Bump `max_turns` down in `.github/workflows/weekly-agent.yml` (currently 200) to cap per-run consumption
2. Move `ai-sweep` to a cheaper model — already on `claude-haiku-4-5-20251001`
3. Reduce sweep frequency (cron change in workflow files)

## Architecture reference

- **`scripts/weekly-agent.ts`** — Builds the per-run prompt file from `data/sources.json` + any pending files. Runs in the workflow before the action.
- **`scripts/ai-sweep.mjs`** — Per-entry source fetcher; shells out to `claude -p` for news extraction (Haiku).
- **`scripts/tools/mcp-server.ts`** — Stdio MCP server providing `send_email` and `create_clickup_task` tools to the weekly agent.
- **`scripts/mcp-config.json`** — Tells the action how to launch the MCP server.
- **`.github/workflows/weekly-agent.yml`** — Uses `anthropics/claude-code-base-action@beta` with `claude_code_oauth_token`.
- **`.github/workflows/ai-sweep.yml`** — Uses CLI subprocess via `node scripts/ai-sweep.mjs`.

The Agent SDK (`@anthropic-ai/claude-agent-sdk`) is no longer in use. Anthropic explicitly excludes the SDK from subscription billing — the CLI is the only subscription-billed surface.
