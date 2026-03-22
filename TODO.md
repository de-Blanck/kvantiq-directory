# UI Fixes — Accessibility, Visual Consistency, Polish

All work on `main` branch at `E:\kvantiq-directory\`.

## Critical

- [x] Fix transparency overview page — replace all 26 inline `style=` attributes using undefined CSS vars (`--text-secondary`, `--bg-secondary`, `--accent-primary`, `--border-primary`) with Tailwind classes (`text-text-secondary`, `bg-surface`, `text-accent`, `border-border`). Also replace `letter-spacing` inline styles with `tracking-[-0.3px]`. File: `src/pages/transparency/index.astro`
- [x] Add global focus-visible styles — add `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` to `src/styles/global.css`. This fixes keyboard navigation visibility across all interactive elements (WCAG 2.4.7).
- [ ] Make DataTable rows keyboard-accessible — in `src/components/DataTable.tsx`, add `tabIndex={0}`, `role="link"`, `onKeyDown` handler (Enter/Space → navigate) to clickable `<tr>` elements. Also add `focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent` class. Do the same for sortable `<th>` headers (add `tabIndex={0}`, `role="button"`, `onKeyDown`).

## Important

- [ ] Fix mobile menu — in `src/components/Header.astro`, add `menu.querySelectorAll('a').forEach(function(link) { link.addEventListener('click', closeMenu); });` after the overlay click listener in the `<script is:inline>` block so menu closes when clicking a nav link.
- [ ] Fix FlipCard colors — in `src/components/FlipCard.tsx`, replace the hardcoded light-mode `colorMap` object with dark-theme-compatible values: `info` → `bg-info/10 border-info/20 text-info`, `ok` → `bg-accent/10 border-accent/20 text-accent`, `warn` → `bg-warn/10 border-warn/20 text-warn`. Also replace `style={{ opacity: 0.7 }}` with class `opacity-70` and `style={{ opacity: 0.5 }}` with class `opacity-50`.

## Polish

- [ ] Replace standard Tailwind-equivalent custom sizes — find and replace: `text-[12px]` → `text-xs`, `text-[14px]` → `text-sm`, `text-[16px]` → `text-base` across all files. These are exact matches to Tailwind defaults.
- [ ] Replace inline letter-spacing styles with Tailwind tracking classes across `src/pages/index.astro` (`tracking-[-0.5px]`), `src/pages/about.astro`, `src/pages/transparency/intelligence.astro`, `src/pages/transparency/audit.astro` (all `tracking-[-0.3px]`).
