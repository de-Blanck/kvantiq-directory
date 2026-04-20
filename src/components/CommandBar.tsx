import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface CommandItem {
  id: string;
  name: string;
  description: string;
  collection: 'companies' | 'benchmarks' | 'use-cases' | 'challenges' | 'resources';
  href: string;
  external?: boolean;
}

interface CommandBarProps {
  items: CommandItem[];
}

const COLLECTION_LABELS: Record<CommandItem['collection'], string> = {
  companies: 'Companies',
  benchmarks: 'Benchmarks',
  'use-cases': 'Use Cases',
  challenges: 'Challenges',
  resources: 'Resources',
};

const COLLECTION_ORDER: CommandItem['collection'][] = [
  'companies',
  'benchmarks',
  'use-cases',
  'challenges',
  'resources',
];

const COLLECTION_BROWSE_HREF: Record<CommandItem['collection'], string> = {
  companies: '/companies/',
  benchmarks: '/benchmarks/',
  'use-cases': '/use-cases/',
  challenges: '/challenges/',
  resources: '/resources/',
};

const MAX_PER_COLLECTION = 8;

/**
 * Flatten grouped results into a single ordered list for keyboard navigation.
 * Each entry is an item + its group; group headers are skipped in the index
 * but rendered in the DOM.
 */
interface FlatResult {
  item: CommandItem;
  groupIndex: number;
}

export default function CommandBar({ items }: CommandBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<Element | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Debounce query at 80ms per spec.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 80);
    return () => window.clearTimeout(t);
  }, [query]);

  const openPalette = useCallback(() => {
    triggerRef.current = document.activeElement;
    setOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setDebouncedQuery('');
    setActiveIndex(0);
    // Return focus to trigger
    const t = triggerRef.current;
    if (t && 'focus' in t && typeof (t as HTMLElement).focus === 'function') {
      (t as HTMLElement).focus();
    }
  }, []);

  // Global Cmd/Ctrl+K listener + custom event from resting SearchBar input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) triggerRef.current = document.activeElement;
          return !prev;
        });
      }
    };
    const onOpenEvt = () => openPalette();
    window.addEventListener('keydown', onKey);
    window.addEventListener('kvantiq:cmdbar-open', onOpenEvt as EventListener);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('kvantiq:cmdbar-open', onOpenEvt as EventListener);
    };
  }, [openPalette]);

  // Focus input + lock body scroll when open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Filter + group results
  const { grouped, flat } = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const buckets: Record<CommandItem['collection'], CommandItem[]> = {
      companies: [],
      benchmarks: [],
      'use-cases': [],
      challenges: [],
      resources: [],
    };
    const matches = q
      ? items.filter((it) => {
          const hay = (it.name + ' ' + it.description).toLowerCase();
          return hay.includes(q);
        })
      : items;

    for (const item of matches) {
      if (buckets[item.collection].length < MAX_PER_COLLECTION) {
        buckets[item.collection].push(item);
      }
    }

    const groups = COLLECTION_ORDER.map((coll) => ({
      collection: coll,
      items: buckets[coll],
      totalMatches: matches.filter((m) => m.collection === coll).length,
    })).filter((g) => g.items.length > 0);

    const flatList: FlatResult[] = [];
    groups.forEach((g, gi) => {
      g.items.forEach((it) => flatList.push({ item: it, groupIndex: gi }));
    });

    return { grouped: groups, flat: flatList };
  }, [debouncedQuery, items]);

  // Reset active index when results change.
  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery]);

  // Scroll active into view
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const navigate = useCallback((item: CommandItem) => {
    closePalette();
    if (item.external) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = item.href;
    }
  }, [closePalette]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePalette();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const target = flat[activeIndex];
        if (target) navigate(target.item);
      }
    },
    [flat, activeIndex, navigate, closePalette],
  );

  // Focus trap — keep Tab inside the dialog.
  const onDialogKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Tab') return;
      const root = listRef.current?.closest('[role="dialog"]');
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'input, button, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [],
  );

  if (!open) return null;

  const showEmptyState = debouncedQuery.trim().length === 0;
  const hasResults = flat.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-void/60 backdrop-blur-sm p-4 pt-24 md:pt-32"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closePalette();
      }}
      onKeyDown={onDialogKeyDown}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-surface shadow-elevated"
        onKeyDown={onKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <svg
            className="h-4 w-4 flex-shrink-0 text-text-muted"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="m17 17-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies, benchmarks, use cases, challenges, resources"
            aria-label="Search the directory"
            className="body-default flex-1 bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <kbd className="rounded border border-border bg-base px-1.5 py-0.5 font-mono text-xs text-text-muted">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto"
          role="listbox"
          aria-label="Search results"
        >
          {showEmptyState && (
            <div className="p-4">
              <p className="eyebrow text-text-muted">Quick links</p>
              <div className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {COLLECTION_ORDER.map((coll) => (
                  <a
                    key={coll}
                    href={COLLECTION_BROWSE_HREF[coll]}
                    className="flex items-center justify-between rounded-md border border-border bg-base px-3 py-2 text-text-secondary hover:border-accent/35 hover:bg-elevated hover:text-text-primary"
                  >
                    <span className="body-sm">Browse {COLLECTION_LABELS[coll]}</span>
                    <span className="eyebrow text-text-muted">{items.filter(i => i.collection === coll).length}</span>
                  </a>
                ))}
              </div>
              <p className="mt-4 eyebrow text-text-muted">Tips</p>
              <ul className="mt-2 space-y-1 body-sm text-text-secondary">
                <li><kbd className="rounded border border-border bg-base px-1.5 py-0.5 font-mono text-xs text-text-muted">Up</kbd> <kbd className="rounded border border-border bg-base px-1.5 py-0.5 font-mono text-xs text-text-muted">Down</kbd> to navigate, <kbd className="rounded border border-border bg-base px-1.5 py-0.5 font-mono text-xs text-text-muted">Enter</kbd> to open, <kbd className="rounded border border-border bg-base px-1.5 py-0.5 font-mono text-xs text-text-muted">Esc</kbd> to close.</li>
              </ul>
            </div>
          )}

          {!showEmptyState && !hasResults && (
            <div className="px-4 py-8 text-center">
              <p className="body-sm text-text-secondary">No results for &ldquo;{debouncedQuery}&rdquo;.</p>
              <p className="mt-2 eyebrow text-text-muted">Try a shorter query or check spelling.</p>
            </div>
          )}

          {!showEmptyState && hasResults && (
            <div className="py-2">
              {grouped.map((group, gi) => {
                const itemsBefore = grouped
                  .slice(0, gi)
                  .reduce((acc, g) => acc + g.items.length, 0);
                const remaining = group.totalMatches - group.items.length;
                return (
                  <div key={group.collection} className="mb-2 last:mb-0">
                    <div className="flex items-baseline justify-between px-4 pb-1.5 pt-2">
                      <span className="eyebrow text-text-muted">{COLLECTION_LABELS[group.collection]}</span>
                      <span className="eyebrow text-text-muted">{group.totalMatches}</span>
                    </div>
                    {group.items.map((item, ii) => {
                      const flatIdx = itemsBefore + ii;
                      const isActive = flatIdx === activeIndex;
                      return (
                        <button
                          key={item.id}
                          data-cmd-idx={flatIdx}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          onClick={() => navigate(item)}
                          className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                            isActive
                              ? 'border-l-2 border-accent bg-elevated'
                              : 'border-l-2 border-transparent hover:bg-elevated/60'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="h-sm text-text-primary truncate">{item.name}</span>
                              {item.external && (
                                <span className="eyebrow text-text-muted">EXT</span>
                              )}
                            </div>
                            <p className="mt-0.5 body-sm text-text-secondary line-clamp-1">
                              {item.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                    {remaining > 0 && (
                      <a
                        href={COLLECTION_BROWSE_HREF[group.collection]}
                        className="block px-4 py-2 body-sm text-text-muted hover:text-accent"
                      >
                        {remaining} more — press enter to browse all {COLLECTION_LABELS[group.collection]}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer keyboard hints */}
        <div className="flex items-center justify-between border-t border-border bg-base px-4 py-2">
          <div className="flex items-center gap-3 body-sm text-text-muted">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-xs text-text-muted">Enter</kbd>
              <span>open</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-xs text-text-muted">Esc</kbd>
              <span>close</span>
            </span>
          </div>
          <span className="eyebrow text-text-muted">{items.length} indexed</span>
        </div>
      </div>
    </div>
  );
}
