import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { eventFilePath, eventSchema, isoDate } from '../../src/lib/events/schema';
import { hostOf, normalizeUrl } from '../../src/lib/events/url';
import { isPublished, type SourceLike } from '../../src/lib/source-bar';
import { candidateSchema } from './candidate';
import { checkCandidate, type EntityInfo, type ExistingEvent, type FetchedPage, type HoldReason } from './check';
import { heldKey, heldListSchema, mergeHeld } from './held';

export type RunOptions = {
  root: string;
  input: unknown;
  today: string;
  dryRun: boolean;
  fetchPage: (url: string) => Promise<FetchedPage>;
};

export type RunSummary = {
  published: string[];
  alreadyPublished: string[];
  held: Record<string, number>;
  invalid: Array<{ index: number; error: string }>;
  stale: number;
  skippedStale: number;
};

function jsonFiles(dir: string, recursive = false): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => join(entry.parentPath, entry.name))
    .sort();
}

function readJson<T>(path: string, parse: (value: unknown) => T): T {
  try {
    return parse(JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

export function loadEntityIndex(root: string): Map<string, EntityInfo> {
  const entities = new Map<string, EntityInfo>();
  for (const collection of ['companies', 'benchmarks', 'use-cases', 'challenges', 'resources']) {
    const dir = join(root, 'src/content', collection);
    for (const path of jsonFiles(dir)) {
      const data = readJson(path, value => value as {
        name: string; website?: string; country?: string; sources?: SourceLike[];
      });
      const key = `${collection}/${path.slice(dir.length + 1, -'.json'.length)}`;
      entities.set(key, {
        key, collection, name: data.name, published: isPublished(data),
        country: data.country ?? null,
        websiteHost: collection === 'companies' ? hostOf(data.website ?? '') || null : null,
      });
    }
  }
  return entities;
}

export function loadExistingEvents(root: string): ExistingEvent[] {
  const events = new Map<string, ExistingEvent>();
  for (const path of jsonFiles(join(root, 'src/content/events'), true)) {
    const { id, entities, type, happenedOn, source } = readJson(path, value => eventSchema.parse(value));
    if (events.has(id)) throw new Error(`${path}: duplicate event id ${id}`);
    const sourceUrls = [...new Set([source.url, source.finalUrl].map(normalizeUrl))];
    events.set(id, { id, entities, type, happenedOn, sourceUrls });
  }
  return [...events.values()];
}

export async function runCheck(opts: RunOptions): Promise<RunSummary> {
  const { root, input, today, dryRun, fetchPage } = opts;
  if (!Array.isArray(input)) throw new Error('Candidates must be a JSON array');
  isoDate.parse(today);
  const entities = loadEntityIndex(root);
  const existing = loadExistingEvents(root);
  const heldPath = join(root, 'data/events-held.json');
  const previous = existsSync(heldPath) ? readJson(heldPath, value => heldListSchema.parse(value)) : [];
  const staleKeys = new Set(previous.filter(record => record.stale).map(record => record.key));
  const resolvedKeys = new Set<string>();
  const holds: Array<{ entities: string[]; sourceUrl: string; reason: HoldReason }> = [];
  const summary: RunSummary = { published: [], alreadyPublished: [], held: {}, invalid: [], stale: 0, skippedStale: 0 };

  for (const [index, item] of input.entries()) {
    const parsed = candidateSchema.safeParse(item);
    if (!parsed.success) {
      summary.invalid.push({ index, error: parsed.error.message });
      continue;
    }
    const candidate = parsed.data;
    const sourceUrl = candidate.source.url;
    const key = heldKey(candidate.entities, sourceUrl);
    if (staleKeys.has(key)) {
      summary.skippedStale++;
      continue;
    }
    const page = await fetchPage(sourceUrl);
    const verdict = checkCandidate(candidate, { page, entities, existing, today });
    if (verdict.status === 'hold') {
      const { reason } = verdict;
      holds.push({ entities: candidate.entities, sourceUrl, reason });
      summary.held[reason] = (summary.held[reason] ?? 0) + 1;
      continue;
    }
    resolvedKeys.add(key);
    if (verdict.status === 'already-published') {
      summary.alreadyPublished.push(verdict.id);
      continue;
    }
    const { record, sourceUrls } = verdict;
    const { id, entities: eventEntities, type, happenedOn } = record;
    if (!dryRun) {
      const path = join(root, eventFilePath(record));
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
    }
    existing.push({ id, entities: eventEntities, type, happenedOn, sourceUrls });
    summary.published.push(id);
  }

  const next = mergeHeld(previous, holds, resolvedKeys, today);
  summary.stale = next.filter(record => record.stale).length;
  if (!dryRun) {
    mkdirSync(dirname(heldPath), { recursive: true });
    const tempPath = heldPath + '.tmp';
    writeFileSync(tempPath, JSON.stringify(next, null, 2) + '\n');
    renameSync(tempPath, heldPath);
  }
  return summary;
}

export async function fetchPageLive(url: string): Promise<FetchedPage> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      redirect: 'follow',
      headers: { 'User-Agent': 'KvantiqDirectoryEventChecker/1.0 (+https://directory.kvantiq.studio/about/)' },
    });
    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      html: await response.text(),
      finalUrl: response.url,
    };
  } catch {
    return { status: 0, contentType: '', html: '', finalUrl: url };
  }
}
