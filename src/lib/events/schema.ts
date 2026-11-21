import { createHash } from 'node:crypto';
import { z } from 'zod';
import { normalizeUrl } from './url';

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

export const CORPORATE_SUBTYPES = ['acquisition', 'merger', 'listing', 'closure'] as const;
export const FUNDING_ROUNDS = [
  'pre-seed', 'seed', 'series-a', 'series-b', 'series-c-plus', 'grant', 'debt', 'ipo', 'undisclosed', 'other',
] as const;
export const EVENT_ORIGINS = ['refresh', 'backfill', 'manual', 'fact-diff'] as const;

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const [year, month, day] = value.split('-').map(Number);
  // Date.UTC adds 1900 to two-digit years. Use the corresponding year in a later Gregorian cycle.
  const utcYear = year < 100 ? year + 400 : year;
  const date = new Date(Date.UTC(utcYear, month - 1, day));
  return date.getUTCFullYear() === utcYear && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, 'Expected a real calendar date');

const sourceUrl = z.url({ protocol: /^https?$/ });
export const eventFields = {
  entities: z.array(z.string().regex(/^(companies|benchmarks|use-cases|challenges|resources)\/[a-z0-9-]+$/))
    .min(1).refine(entities => new Set(entities).size === entities.length, 'Entities must be unique'),
  happenedOn: isoDate,
  foundOn: isoDate,
  summary: z.string().min(1).max(140),
  quote: z.string().min(20).max(300),
  source: z.object({
    url: sourceUrl,
    publisher: z.string().min(1),
    publishedOn: isoDate.optional(),
  }),
  pointers: z.array(sourceUrl),
  change: z.object({ field: z.string(), from: z.json(), to: z.json() }).nullable(),
  origin: z.enum(EVENT_ORIGINS),
};

export const fundingSchema = z.object({
  amount: z.number().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  round: z.enum(FUNDING_ROUNDS),
  investors: z.array(z.string()),
});

const base = z.object({
  ...eventFields,
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]+-\d{4}-\d{2}-\d{2}-(funding|partnership|product|people|corporate|other)-[0-9a-f]{6}$/),
  checks: z.object({
    checkerVersion: z.literal(1),
    checkedOn: isoDate,
    sourceLive: z.literal(true),
    sourceCredible: z.literal(true),
    notPointerOnly: z.literal(true),
    quoteFound: z.literal(true),
    dateFound: z.literal(true),
    amountInQuote: z.literal(true).nullable(),
    typeAgreed: z.literal(true),
  }),
});

const noFundingOrSubtype = { funding: z.null(), subtype: z.null() };
export const RUNTIME_ONLY_RULES: string[] = [
  'Date strings must represent real calendar dates.',
  'Entity keys must be unique within an event.',
  'checks.amountInQuote must be true for funding events with a disclosed amount and null otherwise.',
];

export const eventSchema = z.discriminatedUnion('type', [
  base.extend({ type: z.literal('funding'), funding: fundingSchema, subtype: z.null() }),
  base.extend({ type: z.literal('corporate'), funding: z.null(), subtype: z.enum(CORPORATE_SUBTYPES).nullable() }),
  base.extend({ type: z.literal('partnership'), ...noFundingOrSubtype }),
  base.extend({ type: z.literal('product'), ...noFundingOrSubtype }),
  base.extend({ type: z.literal('people'), ...noFundingOrSubtype }),
  base.extend({ type: z.literal('other'), ...noFundingOrSubtype }),
]).superRefine((record, ctx) => {
  const expected = record.type === 'funding' && record.funding.amount !== null ? true : null;
  if (record.checks.amountInQuote !== expected) {
    ctx.addIssue({ code: 'custom', path: ['checks', 'amountInQuote'], message: RUNTIME_ONLY_RULES[2] });
  }
});

export type EventRecord = z.infer<typeof eventSchema>;

export function computeEventId(primaryEntity: string, happenedOn: string, type: EventType, sourceUrl: string): string {
  const slug = primaryEntity.split('/')[1];
  const hash = createHash('sha256').update(normalizeUrl(sourceUrl)).digest('hex').slice(0, 6);
  return `${slug}-${happenedOn}-${type}-${hash}`;
}

export function eventFilePath(record: Pick<EventRecord, 'id' | 'happenedOn'>): string {
  return `src/content/events/${record.happenedOn.slice(0, 4)}/${record.id}.json`;
}
