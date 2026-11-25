import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EVENT_TYPES, EVENT_TYPE_LABELS } from '../lib/events/labels';
import EventTypeBadge, { EventTypeDot } from './EventTypeBadge';
import { filterRows, parseFilters, type EventRow, type Filters } from '../lib/events/present';

interface EventsViewProps {
  rows: EventRow[];
  countries: string[];
  /** The monthly chart. It sits between the type chips, which scope it, and the list controls, which do not. */
  children?: ReactNode;
}

// The server render and the first client render are always unfiltered, so hydration matches.
// The URL is applied after mount.
const UNFILTERED: Filters = { type: 'all', country: '', q: '' };

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';

/** Tells the chart script which type to show. Fired after mount and when the type changes. */
function announceType(type: Filters['type']) {
  window.dispatchEvent(new CustomEvent('events:filter', { detail: { type } }));
}

/** Writes our three keys and leaves any other query parameter alone. */
function writeUrl(filters: Filters) {
  const params = new URLSearchParams(window.location.search);
  const set = (key: string, value: string) => (value ? params.set(key, value) : params.delete(key));
  set('type', filters.type === 'all' ? '' : filters.type);
  set('country', filters.country);
  set('q', filters.q);
  const qs = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
}

function groupByMonth(rows: EventRow[]): { month: string; rows: EventRow[] }[] {
  const groups: { month: string; rows: EventRow[] }[] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last && last.month === row.month) last.rows.push(row);
    else groups.push({ month: row.month, rows: [row] });
  }
  return groups;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function EventItem({ row }: { row: EventRow }) {
  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 border-b border-border py-4 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-4">
      <time dateTime={row.happenedOn} className="pt-0.5 font-mono text-[13px] tabular-nums text-text-muted">
        {row.day}
      </time>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <EventTypeBadge type={row.type} />
          <span className="text-[15px] font-semibold text-text-primary">
            {row.entities.map((entity, i) => (
              <Fragment key={entity.href}>
                {i > 0 && <span className="font-normal text-text-muted">, </span>}
                <a href={entity.href} className={`rounded-sm hover:text-accent ${FOCUS_RING}`}>
                  {entity.name}
                </a>
              </Fragment>
            ))}
          </span>
        </div>
        <p className="mt-1.5 body-sm text-text-secondary">{row.summary}</p>
        {row.funding && (
          <p className="mt-1 font-mono text-[13px] text-text-primary">{row.funding}</p>
        )}
        <p className="mt-1.5 font-mono text-[12px] text-text-muted">
          source:{' '}
          <a
            href={row.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded-sm text-accent hover:underline hover:underline-offset-2 ${FOCUS_RING}`}
          >
            {row.publisher}
            <span aria-hidden="true"> ↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </div>
    </li>
  );
}

export default function EventsView({ rows, countries, children }: EventsViewProps) {
  const [filters, setFilters] = useState<Filters>(UNFILTERED);
  const allChip = useRef<HTMLButtonElement>(null);
  const announced = useRef<Filters['type'] | null>(null);

  // Search and country changes do not move the chart, so only a changed type is announced.
  const announce = (type: Filters['type']) => {
    if (announced.current === type) return;
    announced.current = type;
    announceType(type);
  };

  useEffect(() => {
    const parsed = parseFilters(window.location.search, countries);
    setFilters(parsed);
    announce(parsed.type);
    // Mount only: the URL is read once; after that the state writes the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (next: Filters) => {
    setFilters(next);
    writeUrl(next);
    announce(next.type);
  };

  const reset = () => {
    update(UNFILTERED);
    allChip.current?.focus();
  };

  const visible = useMemo(() => filterRows(rows, filters), [rows, filters]);
  const groups = useMemo(() => groupByMonth(visible), [visible]);
  const chips: Filters['type'][] = ['all', ...EVENT_TYPES];

  return (
    <div>
      <div role="group" aria-label="Event type" className="mt-8 flex flex-wrap gap-2">
        {chips.map(type => {
          const pressed = filters.type === type;
          return (
            <button
              key={type}
              ref={type === 'all' ? allChip : undefined}
              type="button"
              aria-pressed={pressed}
              onClick={() => update({ ...filters, type })}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[12px] font-medium uppercase tracking-[0.08em] transition-colors ${FOCUS_RING} ${
                pressed
                  ? 'border-accent bg-accent-glow text-accent'
                  : 'border-border bg-base text-text-secondary hover:border-accent/40 hover:text-accent'
              }`}
            >
              {type !== 'all' && <EventTypeDot type={type} />}
              {type === 'all' ? 'All' : EVENT_TYPE_LABELS[type]}
            </button>
          );
        })}
      </div>

      {children}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <label htmlFor="events-country" className="sr-only">
          Country
        </label>
        <select
          id="events-country"
          value={filters.country}
          onChange={e => update({ ...filters, country: e.target.value })}
          className={`rounded-lg border border-border bg-base px-3 py-2 text-sm text-text-primary transition-colors duration-75 focus:border-accent ${FOCUS_RING}`}
        >
          <option value="">All countries</option>
          {countries.map(country => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>

        <div className="relative min-w-[200px] max-w-sm flex-1">
          <svg
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <label htmlFor="events-search" className="sr-only">
            Search events
          </label>
          <input
            id="events-search"
            type="search"
            value={filters.q}
            onChange={e => update({ ...filters, q: e.target.value })}
            placeholder="Search events…"
            className={`w-full rounded-lg border border-border bg-base py-2 pl-9 pr-3 text-sm text-text-primary placeholder-text-muted transition-colors duration-75 focus:border-accent ${FOCUS_RING}`}
          />
        </div>
      </div>

      <div aria-live="polite">
        <p className="mt-4 font-mono text-xs text-text-muted">
          {visible.length === rows.length ? plural(rows.length, 'event') : `${visible.length} of ${plural(rows.length, 'event')}`}
        </p>
        {visible.length === 0 && (
          <div className="mt-4 rounded-xl border border-border bg-base px-6 py-10 text-center">
            <p className="body-sm text-text-secondary">No events match these filters.</p>
            <a
              href="/events/"
              onClick={e => {
                e.preventDefault();
                reset();
              }}
              className={`mt-2 inline-block rounded-sm text-sm text-info underline underline-offset-2 ${FOCUS_RING}`}
            >
              Reset filters
            </a>
          </div>
        )}
      </div>

      {groups.map(group => (
        <section key={group.month} className="mt-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="h-sm text-text-primary">{group.month}</h2>
            <span className="font-mono text-[12px] text-text-muted">{plural(group.rows.length, 'event')}</span>
          </div>
          <ol className="mt-2 border-t border-border">
            {group.rows.map(row => (
              <EventItem key={row.id} row={row} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
