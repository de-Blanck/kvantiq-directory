import { z } from 'zod';
import { CORPORATE_SUBTYPES, EVENT_TYPES, eventFields, fundingSchema, isoDate } from '../../src/lib/events/schema';
import { candidateSchema } from '../events/candidate';
import type { HoldReason } from '../events/check';
import type { BatchEntry } from './batches';
import type { WorkItem } from './types';

export const extractionItemSchema = z.strictObject({
  id: z.string(),
  status: z.enum(['event', 'no-event']),
  reason: z.string().max(200).optional(),
  entities: eventFields.entities.optional(),
  type: z.enum(EVENT_TYPES).optional(),
  subtype: z.enum(CORPORATE_SUBTYPES).nullable().optional(),
  summary: eventFields.summary.optional(),
  quote: eventFields.quote.optional(),
  happenedOn: isoDate.optional(),
  publisher: z.string().min(1).optional(),
  publishedOn: isoDate.optional(),
  funding: fundingSchema.strict().nullable().optional(),
});
export const secondOpinionSchema = z.array(z.strictObject({ id: z.string(), type: z.enum(EVENT_TYPES) }));

export function parseModelJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/.exec(trimmed);
  return JSON.parse(fence ? fence[1] : trimmed);
}

export function buildCandidates(
  batches: BatchEntry[][],
  items: Map<string, WorkItem>,
  extractedRaw: Map<number, string>,
  secondRaw: string | null,
): {
  candidates: unknown[];
  holds: Array<{ entities: string[]; sourceUrl: string; reason: HoldReason }>;
  secondOpinionInput: Array<{ id: string; quote: string; summary: string }>;
} {
  const second = secondRaw === null ? [] : secondOpinionSchema.parse(parseModelJson(secondRaw));
  const opinions = new Map(second.map(row => [row.id, row.type]));
  if (opinions.size !== second.length) throw new Error('Duplicate second-opinion ids');
  const candidates: unknown[] = [];
  const holds: Array<{ entities: string[]; sourceUrl: string; reason: HoldReason }> = [];
  const secondOpinionInput: Array<{ id: string; quote: string; summary: string }> = [];
  for (const [index, batch] of batches.entries()) {
    let rows: unknown[] = [];
    try {
      const parsed = parseModelJson(extractedRaw.get(index) ?? '');
      if (Array.isArray(parsed)) rows = parsed;
    } catch { /* Unusable extraction holds every entry in this batch. */ }
    for (const entry of batch) {
      const item = items.get(entry.id);
      if (!item) throw new Error(`Missing work item ${entry.id}`);
      const hold = () => holds.push({ entities: item.entities, sourceUrl: item.url, reason: 'not-extracted' });
      const matches = rows.filter(row => row !== null && typeof row === 'object' && 'id' in row && row.id === entry.id);
      if (matches.length !== 1) { hold(); continue; }
      const parsed = extractionItemSchema.safeParse(matches[0]);
      if (!parsed.success || parsed.data.status !== 'event') { hold(); continue; }
      const row = parsed.data;
      if (!row.entities || row.entities.length !== item.entities.length || !row.entities.every(entity => item.entities.includes(entity))) {
        hold(); continue;
      }
      const opinion = opinions.get(entry.id);
      const candidate = candidateSchema.safeParse({
        entities: row.entities, type: row.type, subtype: row.subtype, happenedOn: row.happenedOn,
        summary: row.summary, quote: row.quote, funding: row.funding,
        source: { url: item.url, publisher: row.publisher, ...(row.publishedOn === undefined ? {} : { publishedOn: row.publishedOn }) },
        pointers: [], origin: 'backfill',
        foundOn: row.happenedOn && row.happenedOn > item.foundOn ? row.happenedOn : item.foundOn,
        ...(opinion === undefined ? {} : { typeSecondOpinion: opinion }),
      });
      if (!candidate.success) { hold(); continue; }
      candidates.push(candidate.data);
      secondOpinionInput.push({ id: entry.id, quote: candidate.data.quote, summary: candidate.data.summary });
    }
  }
  return { candidates, holds, secondOpinionInput };
}
