import { z } from 'zod';
import { CORPORATE_SUBTYPES, EVENT_TYPES, eventFields, fundingSchema, isoDate } from '../../src/lib/events/schema';

const base = z.object({
  ...eventFields,
  source: eventFields.source.omit({ finalUrl: true }),
  foundOn: isoDate.optional(),
  pointers: eventFields.pointers.default([]),
  change: eventFields.change.default(null),
  typeSecondOpinion: z.enum(EVENT_TYPES).optional(),
});

const noFundingOrSubtype = { funding: z.null().default(null), subtype: z.null().default(null) };

export const candidateSchema = z.discriminatedUnion('type', [
  base.extend({ type: z.literal('funding'), funding: fundingSchema, subtype: z.null().default(null) }),
  base.extend({
    type: z.literal('corporate'),
    funding: z.null().default(null),
    subtype: z.enum(CORPORATE_SUBTYPES).nullable().default(null),
  }),
  base.extend({ type: z.literal('partnership'), ...noFundingOrSubtype }),
  base.extend({ type: z.literal('product'), ...noFundingOrSubtype }),
  base.extend({ type: z.literal('people'), ...noFundingOrSubtype }),
  base.extend({ type: z.literal('other'), ...noFundingOrSubtype }),
]);

export type EventCandidate = z.infer<typeof candidateSchema>;
