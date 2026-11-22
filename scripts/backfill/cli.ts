import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { eventFields, isoDate } from '../../src/lib/events/schema';
import { fetchPageLive, loadEntityIndex, readHeldList } from '../events/run';
import { buildMatcher, loadAliases, loadEventRecords } from './match';
import { prefetchAll } from './prefetch';
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
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, file), JSON.stringify(value, null, 2) + '\n');
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
    case 'prefetch': {
      if (!collection) throw new Error('prefetch requires --collection');
      const items = read<WorkItem[]>('worklist.json');
      if (!items) throw new Error('Missing .backfill/worklist.json; run worklist first.');
      const events = loadEventRecords(root);
      const match = buildMatcher(events, readHeldList(root), loadAliases(root));
      const { pending } = pendingItems(items, collection, match, events);
      console.log(await prefetchAll(pending.filter(item => item.cls === 'fetch'), {
        cacheDir: join(dir, 'pages'), fetchPage: fetchPageLive, today,
      }));
      return;
    }
    case 'batches':
    case 'candidates':
    case 'holds':
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
