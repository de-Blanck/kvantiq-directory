import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { eventFields, isoDate } from '../../src/lib/events/schema';
import { fetchPageLive, loadEntityIndex, readHeldList } from '../events/run';
import { buildMatcher, loadAliases, loadEventRecords } from './match';
import { buildBatches, type BatchEntry } from './batches';
import { buildCandidates } from './candidates';
import { recordHolds } from './holds';
import type { HoldReason } from '../events/check';
import { prefetchAll, readCachedPage } from './prefetch';
import { discoverRefs, harvest } from './harvest';
import { scanLegacy } from './legacy';
import { COLLECTIONS, hash12, type Collection, type Harvest, type WorkClass, type WorkItem } from './types';
import { buildWorklist, pendingItems, recordAliases } from './worklist';

const usage = 'Usage: npm run backfill -- <step> [--collection <c>] [--today YYYY-MM-DD]';
const homepageResolutions = z.array(z.strictObject({
  hid: z.string().regex(/^[0-9a-f]{12}$/),
  url: eventFields.source.shape.url.nullable(),
}));

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      collection: { type: 'string' },
      today: { type: 'string' },
    },
  });
  if (positionals.length !== 1) throw new Error(usage);

  const collection = COLLECTIONS.find((name) => name === values.collection);
  if (values.collection !== undefined && collection === undefined) {
    throw new Error(`Unknown collection "${values.collection}". Expected one of ${COLLECTIONS.join(', ')}.`);
  }
  const today = isoDate.parse(values.today ?? new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Copenhagen',
    dateStyle: 'short',
  }).format(new Date()));

  await dispatch(positionals[0], { root: process.cwd(), collection, today });
}

async function dispatch(step: string, { root, collection, today }: {
  root: string;
  collection?: Collection;
  today: string;
}): Promise<void> {
  const dir = join(root, '.backfill');
  function read<T>(file: string): T | null {
    const path = join(dir, file);
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  }
  function write(file: string, value: unknown): void {
    const path = join(dir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
  }

  switch (step) {
    case 'harvest':
      write('harvest.json', harvest(root, discoverRefs(root)));
      return;
    case 'worklist': {
      const harvested = read<Harvest>('harvest.json');
      const resolved = homepageResolutions.parse(read<unknown>('homepage-resolved.json') ?? []);
      const items = buildWorklist(root, scanLegacy(root), harvested, resolved);
      const entities = loadEntityIndex(root);
      const homepageInput = items.filter(item => item.cls === 'homepage').map(({ url, entities: keys, refs }) => ({
        hid: hash12(url),
        url,
        names: keys.map(key => entities.get(key)?.name ?? key),
        refs,
      }));
      recordAliases(root, items);
      write('worklist.json', items);
      write('homepage-input.json', homepageInput);
      const counts: Record<WorkClass, number> = { fetch: 0, 'pointer-only': 0, blocklisted: 0, homepage: 0 };
      for (const item of items) counts[item.cls]++;
      console.log(counts);
      return;
    }
    case 'prefetch':
    case 'batches': {
      if (!collection) throw new Error(`${step} requires --collection`);
      const items = read<WorkItem[]>('worklist.json');
      if (!items) throw new Error('Missing .backfill/worklist.json; run worklist first.');
      const events = loadEventRecords(root);
      const match = buildMatcher(events, readHeldList(root), loadAliases(root));
      const { pending } = pendingItems(items, collection, match, events);
      const targets = pending.filter(item => item.cls === 'fetch');
      const cacheDir = join(dir, 'pages');
      if (step === 'prefetch') {
        console.log(await prefetchAll(targets, { cacheDir, fetchPage: fetchPageLive, today }));
        return;
      }
      const { batches, holds } = buildBatches(targets, id => readCachedPage(cacheDir, id), loadEntityIndex(root));
      const filenames = new Set<string>();
      for (const [index, batch] of batches.entries()) {
        const filename = `${collection}-${String(index + 1).padStart(2, '0')}.json`;
        write(join('batches', filename), batch);
        filenames.add(filename);
      }
      write(join('holds', `${collection}-prefetch.json`), holds);
      const batchDir = join(dir, 'batches');
      const pattern = new RegExp(`^${collection}-\\d{2,}\\.json$`);
      if (existsSync(batchDir)) {
        for (const filename of readdirSync(batchDir)) {
          if (pattern.test(filename) && !filenames.has(filename)) rmSync(join(batchDir, filename), { force: true });
        }
      }
      return;
    }
    case 'candidates': {
      if (!collection) throw new Error(`${step} requires --collection`);
      const items = read<WorkItem[]>('worklist.json');
      if (!items) throw new Error('Missing .backfill/worklist.json; run worklist first.');
      const batchDir = join(dir, 'batches');
      const pattern = new RegExp(`^${collection}-\\d{2,}\\.json$`);
      const files = existsSync(batchDir) ? readdirSync(batchDir).filter(name => pattern.test(name)).sort() : [];
      const batches = files.map(file => read<BatchEntry[]>(join('batches', file))!);
      const extracted = new Map<number, string>();
      for (const [index, file] of files.entries()) {
        const path = join(dir, 'extracted', file);
        if (existsSync(path)) extracted.set(index, readFileSync(path, 'utf8'));
      }
      const secondPath = join(dir, 'second-opinion', `${collection}.json`);
      const result = buildCandidates(batches, new Map(items.map(item => [item.id, item])), extracted,
        existsSync(secondPath) ? readFileSync(secondPath, 'utf8') : null);
      write(join('candidates', `${collection}.json`), result.candidates);
      write(join('holds', `${collection}-extract.json`), result.holds);
      write(join('second-opinion-input', `${collection}.json`), result.secondOpinionInput);
      return;
    }
    case 'holds': {
      if (!collection) throw new Error(`${step} requires --collection`);
      const items = read<WorkItem[]>('worklist.json');
      if (!items) throw new Error('Missing .backfill/worklist.json; run worklist first.');
      const events = loadEventRecords(root);
      const match = buildMatcher(events, readHeldList(root), loadAliases(root));
      const { pending, partial } = pendingItems(items, collection, match, events);
      const holds: Array<{ entities: string[]; sourceUrl: string; reason: HoldReason }> = [...partial];
      const holdDir = join(dir, 'holds');
      if (existsSync(holdDir)) {
        for (const file of readdirSync(holdDir).sort()) {
          if (file.startsWith(`${collection}-`) && file.endsWith('.json')) {
            holds.push(...read<typeof holds>(join('holds', file))!);
          }
        }
      }
      const reasons = { 'pointer-only': 'pointer-only', blocklisted: 'source-not-credible', homepage: 'homepage-url' } as const;
      for (const item of pending) {
        if (item.cls !== 'fetch') holds.push({ entities: item.entities, sourceUrl: item.url, reason: reasons[item.cls] });
      }
      console.log(recordHolds(root, holds, today));
      return;
    }
    case 'apply':
    case 'reconcile':
    case 'sample':
      throw new Error(`Backfill step "${step}" is not implemented yet.`);
    default:
      throw new Error(`Unknown backfill step "${step}".\n${usage}`);
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
