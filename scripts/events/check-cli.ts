import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { isoDate } from '../../src/lib/events/schema';
import { fetchPageLive, runCheck } from './run';

const usage = 'Usage: npm run events:check -- --candidates <file.json> [--today YYYY-MM-DD] [--dry-run]';

try {
  const { values } = parseArgs({
    options: {
      candidates: { type: 'string' },
      today: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  if (!values.candidates) throw new Error(usage);
  const today = isoDate.parse(values.today ?? new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Copenhagen',
    dateStyle: 'short',
  }).format(new Date()));
  const input: unknown = JSON.parse(readFileSync(values.candidates, 'utf8'));
  const summary = await runCheck({
    root: process.cwd(), input, today, dryRun: values['dry-run'], fetchPage: fetchPageLive,
  });
  console.log(JSON.stringify(summary));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
