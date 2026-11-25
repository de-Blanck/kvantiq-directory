// Pure presentation helpers for the events UI. Type-only imports: React islands import this file.
import type { EventRecord } from './schema';
import type { EventsFeed } from './feed';
import { EVENT_TYPES, FUNDING_ROUND_LABELS, type EventType, type FundingRound } from './labels';

export type EventRow = {
  id: string;
  happenedOn: string;
  month: string;
  day: string;
  type: EventType;
  entities: { name: string; href: string; country: string | null }[];
  summary: string;
  publisher: string;
  sourceUrl: string;
  funding: string | null;
};

export type Filters = { type: EventType | 'all'; country: string; q: string };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' };

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

export function monthHeading(date: string): string {
  const [y, m] = parts(date);
  return `${MONTHS[m - 1]} ${y}`;
}

export function dayLabel(date: string): string {
  const [, m, d] = parts(date);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** "1 Nov 2026": entry timelines are not grouped by month, so each row carries its year. */
export function dayYearLabel(date: string): string {
  return `${dayLabel(date)} ${parts(date)[0]}`;
}

function amountText(amount: number, currency: string | null): string {
  const prefix = currency === null ? '' : SYMBOLS[currency] ?? `${currency} `;
  if (amount >= 1e9) return `${prefix}${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `${prefix}${(amount / 1e6).toFixed(1)}M`;
  return `${prefix}${amount.toLocaleString('en-GB')}`;
}

export function fundingLine(f: { amount: number | null; currency: string | null; round: FundingRound; investors: string[] }): string {
  const amount = f.amount === null ? 'undisclosed' : amountText(f.amount, f.currency);
  const line = `${FUNDING_ROUND_LABELS[f.round]}, ${amount}`;
  return f.investors.length > 0 ? `${line} · ${f.investors[0]}` : line;
}

export function toEventRow(event: EventRecord, entities: EventsFeed['entities']): EventRow {
  return {
    id: event.id,
    happenedOn: event.happenedOn,
    month: monthHeading(event.happenedOn),
    day: dayLabel(event.happenedOn),
    type: event.type,
    entities: event.entities.map(key => {
      const entity = entities[key];
      return { name: entity.name, href: entity.href, country: entity.country };
    }),
    summary: event.summary,
    publisher: event.source.publisher,
    sourceUrl: event.source.finalUrl,
    funding: event.type === 'funding' ? fundingLine(event.funding) : null,
  };
}

export function parseFilters(search: string, countries: string[]): Filters {
  const params = new URLSearchParams(search);
  const type = params.get('type') ?? '';
  const country = params.get('country') ?? '';
  return {
    type: (EVENT_TYPES as readonly string[]).includes(type) ? (type as EventType) : 'all',
    country: countries.includes(country) ? country : '',
    q: params.get('q') ?? '',
  };
}

export function filterRows(rows: EventRow[], f: Filters): EventRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter(row => {
    if (f.type !== 'all' && row.type !== f.type) return false;
    if (f.country && !row.entities.some(e => e.country === f.country)) return false;
    if (!q) return true;
    const haystack = [row.summary, row.publisher, row.funding ?? '', ...row.entities.map(e => e.name)].join('\n').toLowerCase();
    return haystack.includes(q);
  });
}

export function countryOptions(rows: EventRow[]): string[] {
  const countries = new Set<string>();
  for (const row of rows) for (const e of row.entities) if (e.country) countries.add(e.country);
  return [...countries].sort((a, b) => a.localeCompare(b));
}

export function monthlyCounts(rows: EventRow[], endMonth: string, months = 24): { labels: string[]; series: Record<EventType, number[]> } {
  const [endY, endM] = parts(`${endMonth}-01`);
  const keys: string[] = [];
  const labels: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const index = endY * 12 + (endM - 1) - i;
    const y = Math.floor(index / 12);
    const m = index % 12;
    keys.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    labels.push(`${MONTHS[m].slice(0, 3)} ${y}`);
  }
  const series = Object.fromEntries(EVENT_TYPES.map(t => [t, keys.map(() => 0)])) as Record<EventType, number[]>;
  for (const row of rows) {
    const slot = keys.indexOf(row.happenedOn.slice(0, 7));
    if (slot >= 0) series[row.type][slot]++;
  }
  return { labels, series };
}
