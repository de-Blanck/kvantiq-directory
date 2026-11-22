import { z } from 'zod';
import { eventFields, isoDate } from '../../src/lib/events/schema';
import { normalizeUrl } from '../../src/lib/events/url';
import { HOLD_REASONS, type HoldReason } from './check';

export type HeldRecord = {
  key: string;
  entities: string[];
  sourceUrl: string;
  reason: HoldReason;
  firstHeldOn: string;
  lastCheckedOn: string;
  attempts: number;
  stale: boolean;
};

export const STALE_AFTER_WEEKS = 8;

export function heldKey(entities: string[], sourceUrl: string): string {
  return `${entities[0]}|${normalizeUrl(sourceUrl)}`;
}

export function isoWeek(date: string): string {
  const thursday = new Date(`${date}T00:00:00Z`);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const year = thursday.getUTCFullYear();
  const firstDay = new Date(thursday);
  firstDay.setUTCMonth(0, 1);
  const week = Math.floor((thursday.getTime() - firstDay.getTime()) / 604_800_000) + 1;
  return `${String(year).padStart(4, '0')}-W${String(week).padStart(2, '0')}`;
}

export const heldListSchema = z.array(z.strictObject({
  key: z.string(),
  entities: eventFields.entities,
  sourceUrl: eventFields.source.shape.url,
  reason: z.enum(HOLD_REASONS),
  firstHeldOn: isoDate,
  lastCheckedOn: isoDate,
  attempts: z.int().min(1),
  stale: z.boolean(),
}).refine(record => record.key === heldKey(record.entities, record.sourceUrl), 'Held key does not match its source')
  .refine(record => record.stale === (record.attempts >= STALE_AFTER_WEEKS), 'Held stale flag does not match attempts'))
  .refine(records => new Set(records.map(record => record.key)).size === records.length, 'Duplicate held key');

export function mergeHeld(
  previous: HeldRecord[],
  holds: Array<{ entities: string[]; sourceUrl: string; reason: HoldReason }>,
  resolvedKeys: Set<string>,
  today: string,
): HeldRecord[] {
  const prior = new Map(previous.map(record => [record.key, record]));
  const current = new Map(holds.map(hold => [heldKey(hold.entities, hold.sourceUrl), hold]));
  const keys = [...new Set([...prior.keys(), ...current.keys()])].sort();
  const week = isoWeek(today);
  const records: HeldRecord[] = [];

  for (const key of keys) {
    if (resolvedKeys.has(key)) continue;
    const before = prior.get(key);
    const hold = current.get(key);
    const identity = (hold ?? before)!;
    const ages = before && !before.stale && isoWeek(before.lastCheckedOn) !== week;
    const attempts = before ? before.attempts + Number(Boolean(ages)) : 1;
    records.push({
      key,
      entities: identity.entities,
      sourceUrl: identity.sourceUrl,
      reason: identity.reason,
      firstHeldOn: before?.firstHeldOn ?? today,
      lastCheckedOn: hold || ages ? today : before!.lastCheckedOn,
      attempts,
      stale: attempts >= STALE_AFTER_WEEKS,
    });
  }
  return records;
}
