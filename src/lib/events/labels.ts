// Pure labels and colours for the events UI. No Node imports: React islands import this file.
import type { HoldReason } from '../../../scripts/events/check';

export const EVENT_TYPES = ['funding', 'partnership', 'product', 'people', 'corporate', 'other'] as const;
export type EventType = typeof EVENT_TYPES[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  funding: 'Funding',
  partnership: 'Partnerships & contracts',
  product: 'Products & milestones',
  people: 'People',
  corporate: 'Corporate',
  other: 'Other',
};

// Hues from the Editorial Light theme in src/styles/global.css: accent amber, info blue, stone-500,
// plus the 700-weight teal and violet that sit next to them. Shared by badge dots and chart datasets.
export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  funding: '#B45309',
  partnership: '#1D4ED8',
  product: '#0F766E',
  people: '#6D28D9',
  corporate: '#DC2626',
  other: '#78716C',
};

export const FUNDING_ROUNDS = [
  'pre-seed', 'seed', 'series-a', 'series-b', 'series-c-plus', 'grant', 'debt', 'ipo', 'undisclosed', 'other',
] as const;
export type FundingRound = typeof FUNDING_ROUNDS[number];

export const FUNDING_ROUND_LABELS: Record<FundingRound, string> = {
  'pre-seed': 'Pre-seed',
  seed: 'Seed',
  'series-a': 'Series A',
  'series-b': 'Series B',
  'series-c-plus': 'Series C+',
  grant: 'Grant',
  debt: 'Debt',
  ipo: 'IPO',
  undisclosed: 'Undisclosed round',
  other: 'Other',
};

export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  'unknown-entity': 'Names an entry that is not in the directory',
  'entity-unpublished': 'Names an entry that is not published',
  'source-unreachable': 'Source page could not be fetched',
  'source-not-html': 'Source is not a web page',
  'source-not-credible': 'Source is not on the credible-source list',
  'self-published-other': "Company's own post about another party",
  'self-published-wording': "Company's own post, claim worded as fact",
  'pointer-only': 'Aggregator link, original source not yet found',
  'quote-not-found': 'Quoted text not found on the source page',
  'date-not-found': 'Event date not found on the source page',
  'amount-not-in-quote': 'Funding amount not stated in the quote',
  'type-unchecked': 'Event type not yet checked',
  'type-disagreement': 'Event type disagrees with the source text',
  'possible-duplicate': 'May duplicate a published event',
  'homepage-url': 'Links to a homepage, not an article',
  'not-extracted': 'Not yet read',
};
