# Kvantiq Directory

A structured, source-cited directory of the European quantum computing ecosystem — companies, benchmarks, use cases, and challenges. Focused on Nordics and DACH, optimised for Google SEO and LLM discoverability.

**Live:** https://directory.kvantiq.studio

## What's in it

| Collection | Count | Shape |
|---|---|---|
| Companies | 74 | Hardware, software, services across EU |
| Benchmarks | 32 | Algorithm · hardware · qubits · framework |
| Use cases | 23 | Industry problem → quantum approach → results |
| Challenges | 12 | Hackathons, prizes, and open competitions |
| Resources | 42 | Papers, tools, courses, community |

Every entry carries at minimum two verified sources with dates accessed.

## Stack

- **Astro 6** (static output), **Tailwind CSS 4**, **React** for interactive components
- **Pagefind** for client-side search (no server)
- **Zod** schema validation at build time
- **Vercel** hosting (free tier)

## Run locally

```bash
npm install
npm run dev             # localhost:4321
npm run build           # static build + pagefind index
npm run audit:content   # content quality report
```

## Repository layout

```
src/
  components/       React + Astro components
  content/          JSON source-of-truth for all collections
  content.config.ts Zod schemas
  layouts/          Astro layouts
  lib/              Utilities (related-items, helpers)
  pages/            Routes (index, [slug], country pages)
  styles/           Global CSS + design tokens
public/             Static assets (icons, logos, manifests, robots)
scripts/            Content audit, weekly agent, DB migration
data/               sources.json (hand-curated source registry)
scheduler/          launchd / Task Scheduler installers for the content sweep
```

## Contributing

Content contributions welcome. To add or update an entry:

1. Branch off `main` as `content/<slug>` (or `fix/<slug>` for corrections)
2. Add or edit the JSON file under `src/content/<collection>/`
3. Ensure the Zod schema passes (`npm run build` validates)
4. Include at least **two verified sources** in the `sources` array
5. Open a PR using the template — CI runs the build and content quality checks

See `CLAUDE.md` for AI-assistant guidance, design-system rules, and content quality thresholds (RICH / ADEQUATE / SPARSE ratings).

## Licence

- **Code and site infrastructure** (everything outside `src/content/` and `data/sources.json`): MIT — see [`LICENSE`](./LICENSE)
- **Data** (companies, benchmarks, use cases, challenges, resources, and source citations): CC BY 4.0 — see [`LICENSE-DATA`](./LICENSE-DATA)

## Attribution

Built by [Kvantiq Studio ApS](https://kvantiq.studio). Partly funded by Innovation Fund Denmark.
