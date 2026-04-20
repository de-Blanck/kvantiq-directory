import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export interface SearchItem {
  id: string;
  name: string;
  description: string;
  collection: 'companies' | 'benchmarks' | 'use-cases' | 'challenges' | 'resources';
  href: string;
  external?: boolean;
}

interface Props {
  items: SearchItem[];
  placeholder?: string;
}

const collectionLabels: Record<SearchItem['collection'], string> = {
  companies: 'Company',
  benchmarks: 'Benchmark',
  'use-cases': 'Use Case',
  challenges: 'Challenge',
  resources: 'Resource',
};

/**
 * Elastic-expand searchbar, center-anchored.
 * Collapsed: small magnifier pill (44×44), horizontally centered in its container.
 * On click: spring-animates width outward from center (bidirectional) so the pill
 * grows to the left AND right simultaneously, never drifting off-axis.
 * Esc / click-outside collapses. No global shortcut, no modal — just a local affordance.
 *
 * Technique: the outer wrapper is flex+justify-center so the pill is centered at rest.
 * The inner motion.div uses `mx-auto` + an explicit animated width (not framer `layout`)
 * so width interpolates from 44px → target, and `mx-auto` keeps the element
 * centered on every frame — symmetric outward growth from the midpoint.
 */
export default function SearchExpand({ items, placeholder = 'Search the directory…' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return items
      .filter(it => it.name.toLowerCase().includes(q) || it.description.toLowerCase().includes(q))
      .slice(0, 6);
  }, [items, q]);

  // Focus input a tick after expand completes
  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), reduceMotion ? 0 : 220);
      return () => window.clearTimeout(t);
    }
    setActiveIdx(-1);
    setQuery('');
  }, [open, reduceMotion]);

  // Click-outside collapse
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const go = (item: SearchItem) => {
    if (item.external) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = item.href;
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = results[activeIdx >= 0 ? activeIdx : 0];
      if (pick) go(pick);
    }
  };

  const spring = reduceMotion
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.9 };

  // Target expanded width: caps out at the parent max (max-w-2xl ≈ 672px);
  // using 100% lets it fill whatever the parent allows, but framer-motion
  // needs a numeric target on width animations, so we interpolate between
  // 44px collapsed and 672px expanded and clamp with CSS `max-w-full`.
  const collapsedWidth = 44;
  const expandedWidth = 672;

  return (
    <div ref={containerRef} className="relative flex w-full justify-center">
      <motion.div
        initial={false}
        animate={{ width: open ? expandedWidth : collapsedWidth }}
        transition={spring}
        className={`relative mx-auto flex max-w-full items-center rounded-full border bg-surface shadow-subtle overflow-hidden
          ${open ? 'border-accent/40' : 'border-border hover:border-accent/50'}`}
        style={{ height: '44px' }}
      >
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close search' : 'Open search'}
          aria-expanded={open}
          className="shrink-0 flex h-11 w-11 items-center justify-center text-text-muted transition-colors hover:text-accent focus:outline-none focus-visible:text-accent"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="9" cy="9" r="6" />
            <path d="m17 17-3.5-3.5" strokeLinecap="round" />
          </svg>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.input
              key="input"
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIdx(-1); }}
              onKeyDown={onKey}
              placeholder={placeholder}
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.18, delay: reduceMotion ? 0 : 0.1 }}
              className="flex-1 bg-transparent pr-4 py-2 body-default text-text-primary placeholder:text-text-muted outline-none"
              aria-label="Search query"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="search-expand-results"
            />
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            key="results"
            id="search-expand-results"
            role="listbox"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 right-0 top-[52px] z-40 overflow-hidden rounded-xl border border-border bg-surface shadow-elevated"
          >
            {results.map((item, i) => (
              <button
                key={item.id}
                role="option"
                aria-selected={i === activeIdx}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => go(item)}
                className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0
                  ${i === activeIdx ? 'bg-elevated' : 'bg-transparent hover:bg-elevated'}`}
              >
                <span className="eyebrow shrink-0 mt-0.5 text-text-muted">{collectionLabels[item.collection]}</span>
                <span className="flex-1 min-w-0">
                  <span className="block h-sm text-text-primary truncate">{item.name}</span>
                  <span className="block body-sm text-text-secondary line-clamp-1">{item.description}</span>
                </span>
                {item.external && <span className="eyebrow shrink-0 text-accent">↗</span>}
              </button>
            ))}
          </motion.div>
        )}
        {open && q && results.length === 0 && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute left-0 right-0 top-[52px] z-40 rounded-xl border border-border bg-surface px-4 py-3 shadow-elevated"
          >
            <p className="body-sm text-text-muted">No matches for <span className="text-text-primary">"{query}"</span></p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
