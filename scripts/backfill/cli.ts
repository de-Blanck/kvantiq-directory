import { parseArgs } from 'node:util';
import { isoDate } from '../../src/lib/events/schema';
import { COLLECTIONS, type Collection } from './types';

const usage = 'Usage: npm run backfill -- <step> [--collection <c>] [--today YYYY-MM-DD]';

function main(): void {
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

  dispatch(positionals[0], { root: process.cwd(), collection, today });
}

function dispatch(step: string, _options: {
  root: string;
  collection?: Collection;
  today: string;
}): void {
  switch (step) {
    case 'harvest':
    case 'worklist':
    case 'prefetch':
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
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
