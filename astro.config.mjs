// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

import fs from 'node:fs';
import path from 'node:path';
import { isBlocklistedSource } from './scripts/ai-sweep.mjs';

// Entries below the 3-credible-source bar (CLAUDE.md -> "Source credibility") are
// unlisted: excluded from listings, search and this sitemap, but still reachable at
// their own URL and served noindex. Computed here rather than hardcoded so the
// sitemap tracks the content, and using the sweep's own blocklist so the site and
// `npm run audit:sources` cannot disagree about what "credible" means.
const CONTENT_DIR = path.join(import.meta.dirname, 'src/content');
const DETAIL_ROUTES = { companies: 'companies', benchmarks: 'benchmarks', 'use-cases': 'use-cases', challenges: 'challenges' };

function unlistedPaths() {
  const out = new Set();
  for (const [collection, route] of Object.entries(DETAIL_ROUTES)) {
    const dir = path.join(CONTENT_DIR, collection);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      const credible = (data.sources || []).filter(
        (/** @type {{ url: string, title?: string }} */ s) =>
          !isBlocklistedSource({ url: s.url, source: s.title || '' }),
      ).length;
      if (credible < 3) out.add(`/${route}/${data.slug}/`);
    }
  }
  return out;
}

const UNLISTED = unlistedPaths();

// https://astro.build/config
export default defineConfig({
  site: 'https://directory.kvantiq.studio',
  output: 'static',
  // Astro 7 changed this default to 'jsx', which strips whitespace by JSX rules
  // rather than HTML rules and silently alters inline spacing across the site.
  // Pinned to the previous behaviour so the version upgrade changes no output;
  // adopting 'jsx' is its own change, with its own screenshots.
  compressHTML: true,
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [
    sitemap({
      filter: (page) => !UNLISTED.has(new URL(page).pathname),
    }),
    react(),
  ]
});