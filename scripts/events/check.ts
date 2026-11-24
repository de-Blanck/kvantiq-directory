import { POINTER_ONLY_DOMAINS } from '../../src/lib/events/pointer-domains';
import { computeEventId, eventSchema, type EventRecord } from '../../src/lib/events/schema';
import { hostOf, isHostOrSubdomain, normalizeUrl } from '../../src/lib/events/url';
import { isCredibleSource } from '../../src/lib/source-bar';
import type { EventCandidate } from './candidate';
import { amountInQuote, dateFound, hasSourceDate, htmlToText, quoteFound, sourceDate } from './page';

export type FetchedPage = { status: number; contentType: string; html: string; finalUrl: string };
export type EntityInfo = { key: string; collection: string; name: string; published: boolean; websiteHost: string | null; country: string | null };
export type ExistingEvent = Pick<EventRecord, 'id' | 'entities' | 'type' | 'happenedOn'> & { sourceUrls: string[] };
export type CheckContext = { page: FetchedPage; entities: Map<string, EntityInfo>; existing: ExistingEvent[]; today: string };
export const HOLD_REASONS = [
  'unknown-entity', 'entity-unpublished', 'source-unreachable',
  'source-not-html', 'source-not-credible', 'self-published-other',
  'self-published-wording', 'pointer-only', 'quote-not-found',
  'date-not-found', 'amount-not-in-quote', 'type-unchecked',
  'type-disagreement', 'possible-duplicate',
  'homepage-url', 'not-extracted',
] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];
export type Verdict =
  | { status: 'publish'; record: EventRecord; sourceUrls: string[] }
  | { status: 'already-published'; id: string }
  | { status: 'hold'; reason: HoldReason };

function hold(reason: HoldReason): Verdict {
  return { status: 'hold', reason };
}

function entityHold(c: EventCandidate, entities: CheckContext['entities']): HoldReason | undefined {
  if (c.entities.some(key => !entities.has(key))) return 'unknown-entity';
  if (c.entities.some(key => !entities.get(key)!.published)) return 'entity-unpublished';
}

function sourceHold(publisher: string, urls: string[], hosts: string[]): HoldReason | undefined {
  if (urls.some(url => !isCredibleSource({ url, title: publisher }))) return 'source-not-credible';
  if (hosts.some(host => POINTER_ONLY_DOMAINS.some(domain => isHostOrSubdomain(host, domain)))) {
    return 'pointer-only';
  }
}

export function prefetchHold(c: EventCandidate, entities: CheckContext['entities']): HoldReason | undefined {
  return entityHold(c, entities) ?? sourceHold(c.source.publisher, [c.source.url], [hostOf(c.source.url)]);
}

export function checkCandidate(c: EventCandidate, ctx: CheckContext): Verdict {
  const { page, entities, existing, today } = ctx;
  const primary = c.entities[0];
  const entityReason = entityHold(c, entities);
  if (entityReason) return hold(entityReason);
  if (page.status !== 200) return hold('source-unreachable');
  if (!page.contentType.toLowerCase().includes('text/html')) return hold('source-not-html');

  const sourceUrls = [c.source.url, page.finalUrl];
  const hosts = sourceUrls.map(hostOf);
  const sourceReason = sourceHold(c.source.publisher, sourceUrls, hosts);
  if (sourceReason) return hold(sourceReason);

  const sourceCompanies = [...entities.values()].filter(company => {
    const { websiteHost } = company;
    return company.collection === 'companies' && websiteHost &&
      hosts.some(host => isHostOrSubdomain(host, websiteHost));
  });
  if (sourceCompanies.some(company => company.key !== primary)) return hold('self-published-other');
  if (sourceCompanies.some(company => !c.summary.toLowerCase().startsWith(`${company.name} announced`.toLowerCase()))) {
    return hold('self-published-wording');
  }

  const text = htmlToText(page.html);
  if (!quoteFound(c.quote, text)) return hold('quote-not-found');
  // On arXiv and GitHub release-tag pages only the page's own date counts (first version, release).
  // It is read from the final URL, so a redirect away from such a page, another date or no date is held.
  const dateOk = hasSourceDate(c.source.url) || hasSourceDate(page.finalUrl)
    ? sourceDate(page.finalUrl, page.html, text) === c.happenedOn
    : dateFound(c.happenedOn, page.html, text);
  if (!dateOk) return hold('date-not-found');
  const amount = c.funding?.amount ?? null;
  if (amount !== null && !amountInQuote(amount, c.funding!.currency, c.quote)) return hold('amount-not-in-quote');
  if (!c.typeSecondOpinion) return hold('type-unchecked');
  if (c.typeSecondOpinion !== c.type) return hold('type-disagreement');

  const urls = [...new Set(sourceUrls.map(normalizeUrl))];
  const sharesUrl = (event: ExistingEvent) => event.sourceUrls.some(url => urls.includes(url));
  const alreadyPublished = existing.find(event => event.entities[0] === primary && sharesUrl(event));
  if (alreadyPublished) return { status: 'already-published', id: alreadyPublished.id };

  const timestamp = Date.parse(c.happenedOn);
  if (existing.some(event => sharesUrl(event) || (
    event.entities[0] === primary && event.type === c.type &&
    Math.abs(Date.parse(event.happenedOn) - timestamp) <= 7 * 86_400_000
  ))) return hold('possible-duplicate');

  const record = eventSchema.parse({
    ...c,
    source: { ...c.source, finalUrl: page.finalUrl },
    schemaVersion: 1,
    id: computeEventId(primary, c.happenedOn, c.type, c.source.url),
    foundOn: c.foundOn ?? today,
    checks: {
      checkerVersion: 1,
      checkedOn: today,
      sourceLive: true,
      sourceCredible: true,
      notPointerOnly: true,
      quoteFound: true,
      dateFound: true,
      amountInQuote: amount !== null ? true : null,
      typeAgreed: true,
    },
  });
  return { status: 'publish', record, sourceUrls: urls };
}
