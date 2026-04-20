# Archived Planning Artifacts — March 2026

These files are a **frozen snapshot** of the initial planning for the Kvantiq
Directory site (March 18–23, 2026). They were produced by the Superpowers
skill workflow that preceded the current planning process.

**They are not maintained.** Reading them for historical interest is fine; relying
on them for "how things work today" is not.

## Where the current versions live

| Planning artifact | Current state |
|---|---|
| `plans/2026-03-18-kvantiq-directory.md` — initial scaffold | The site itself — `src/`, `astro.config.mjs`, `package.json` on `main` |
| `plans/2026-03-19-content-buildout.md` — content buildout | `src/content/**/*.json` — 74 companies, 32 benchmarks, 23 use-cases, 12 challenges, 42 resources |
| `plans/2026-03-20-ui-redesign.md` — first UI redesign | Superseded by subsequent redesigns. Current UI = DS v1.1 + marketing-dark palette on `feature/kvantiq-studio-branding` |
| `plans/2026-03-21-weekly-agent.md` — weekly content agent | `scripts/weekly-agent.ts` + `.github/workflows/weekly-agent.yml` on `main` |
| `plans/2026-03-23-content-enrichment-editorial-theme.md` — editorial theme + enrichment | Editorial Light theme was replaced; current theme lives in `src/styles/global.css`. Content enrichment policy lives in `CLAUDE.md` on `main` |
| `specs/*` | See corresponding plan file above |

## Conventions going forward

Planning for new work no longer lives in this directory. The current process is:

- **Feature/fix design discussion:** handled in-session via the Superpowers
  `brainstorming` skill; outcomes captured in the PR description and commit
  messages rather than standalone markdown files.
- **Roadmap / milestones:** tracked in ClickUp (workspace `Kvantiq Studio ApS`)
  and reflected in `docs/product/roadmap.md` if/when that file is added.
- **AI-assistant guidance:** `CLAUDE.md` at repo root.

## How to recover this archive later

This branch is **`archive/superpowers-planning-2026-03`** on
`origin`. To browse it without switching workspaces:

```bash
git fetch origin archive/superpowers-planning-2026-03
git show origin/archive/superpowers-planning-2026-03:docs/superpowers/plans/2026-03-18-kvantiq-directory.md
```

Or check out a read-only copy:

```bash
git worktree add ../kvantiq-directory-archive archive/superpowers-planning-2026-03
```

---

Frozen: 2026-04-20
