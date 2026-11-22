import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { eventSchema, type EventRecord } from '../../src/lib/events/schema';
import { normalizeUrl } from '../../src/lib/events/url';
import type { HeldRecord } from '../events/held';
import type { Aliases, MatchResult } from './types';

export const ALIASES_PATH = 'data/legacy-url-aliases.json';

export function loadEventRecords(root: string): EventRecord[] {
  const dir = join(root, 'src/content/events');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => join(entry.parentPath, entry.name))
    .sort()
    .map(path => {
      try {
        return eventSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
      } catch (error) {
        throw new Error(`Invalid event record at ${path}`, { cause: error });
      }
    });
}

export function loadAliases(root: string): Aliases {
  const path = join(root, ALIASES_PATH);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
}

export function eventUrls(event: EventRecord): string[] {
  return [event.source.url, event.source.finalUrl, ...event.pointers].map(normalizeUrl);
}

export function buildMatcher(events: EventRecord[], held: HeldRecord[], aliases: Aliases):
  (entity: string, url: string) => MatchResult {
  const eventMatches = new Map<string, string>();
  const heldMatches = new Map<string, HeldRecord['reason']>();
  for (const event of events) {
    for (const url of eventUrls(event)) {
      for (const entity of event.entities) {
        const key = `${entity}|${url}`;
        if (!eventMatches.has(key)) eventMatches.set(key, event.id);
      }
    }
  }
  for (const record of held) {
    const url = normalizeUrl(record.sourceUrl);
    for (const entity of record.entities) {
      const key = `${entity}|${url}`;
      if (!heldMatches.has(key)) heldMatches.set(key, record.reason);
    }
  }

  return (entity, url) => {
    const key = `${entity}|${normalizeUrl(url)}`;
    const alias = aliases[key];
    const aliasKey = alias === undefined ? key : `${entity}|${alias}`;
    const eventId = eventMatches.get(key) ?? eventMatches.get(aliasKey);
    if (eventId !== undefined) return { status: 'event', eventId };
    const reason = heldMatches.get(key) ?? heldMatches.get(aliasKey);
    return reason === undefined ? null : { status: 'held', reason };
  };
}
