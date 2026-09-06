/**
 * `npm run audit:content` — RICH / ADEQUATE / SPARSE per entry, with the worklist
 * of everything below adequate.
 *
 * The rules themselves live in src/lib/content-quality.ts so the Audit Dashboard
 * renders the same ratings this prints. This file is the command line around them.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { rateEntry, ratingCounts, COLLECTIONS, type RatedEntry } from '../src/lib/content-quality.ts';

const CONTENT_DIR = join(import.meta.dirname, '..', 'src', 'content');

function readCollection(collection: (typeof COLLECTIONS)[number]): RatedEntry[] {
  const dir = join(CONTENT_DIR, collection);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const data = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as Record<string, unknown>;
      return rateEntry(collection, { ...data, slug: data.slug ?? f.replace('.json', '') });
    });
}

const results = COLLECTIONS.flatMap(readCollection);
const counts = { RICH: 0, ADEQUATE: 0, SPARSE: 0 };
for (const r of results) counts[r.rating]++;

console.log('\n=== CONTENT QUALITY AUDIT ===\n');
console.log(`Total entries: ${results.length}`);
console.log(`  RICH:     ${counts.RICH}`);
console.log(`  ADEQUATE: ${counts.ADEQUATE}`);
console.log(`  SPARSE:   ${counts.SPARSE}`);

for (const row of ratingCounts(results)) {
  console.log(`\n--- ${row.collection} (${row.total}) ---`);
  console.log(`  RICH: ${row.RICH}  ADEQUATE: ${row.ADEQUATE}  SPARSE: ${row.SPARSE}`);
}

const sparse = results.filter((r) => r.rating === 'SPARSE');
if (sparse.length > 0) {
  console.log('\n=== ENTRIES BELOW ADEQUATE THRESHOLD ===\n');
  for (const r of sparse) {
    console.log(`  [${r.collection}] ${r.slug}`);
    for (const issue of r.issues) console.log(`    - ${issue}`);
  }
}

console.log('\n');
