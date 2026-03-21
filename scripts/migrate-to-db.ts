import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import { v4 as uuid } from 'uuid';
import { getDb } from './db/index.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface Source {
  type: string;
  url: string;
  title?: string;
  dateAccessed?: string;
}

interface ContentEntry {
  name: string;
  slug: string;
  type?: string;
  category?: string;
  status?: string;
  website?: string;
  country?: string;
  founded?: number | string;
  sources?: Source[];
  [key: string]: unknown;
}

type Collection = 'companies' | 'benchmarks' | 'use-cases' | 'challenges' | 'resources';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);

const CONTENT_DIR = resolve(import.meta.dirname, '../src/content');

const COLLECTIONS: Collection[] = [
  'companies',
  'benchmarks',
  'use-cases',
  'challenges',
  'resources',
];

function getSubcategory(collection: Collection, data: ContentEntry): string | null {
  switch (collection) {
    case 'companies':
      return data.type ?? null;
    case 'benchmarks':
    case 'use-cases':
      return data.category ?? null;
    case 'challenges':
      return data.status ?? null;
    case 'resources':
      return data.type ?? null;
    default:
      return null;
  }
}

function getUrl(data: ContentEntry): string | null {
  if (data.website) return data.website;
  if (Array.isArray(data.sources) && data.sources.length > 0) {
    return data.sources[0].url ?? null;
  }
  return null;
}

function getFoundedDate(founded: number | string | undefined): string | null {
  if (founded === undefined || founded === null) return null;
  return String(founded);
}

// ── Main ─────────────────────────────────────────────────────────────────────

function migrate(): void {
  const db = getDb();

  // Prepared statements
  const insertEntry = db.prepare(`
    INSERT OR IGNORE INTO entries (
      id, name, collection, subcategory, slug, url, country,
      date_added, date_last_verified, status, current_confidence
    ) VALUES (
      @id, @name, @collection, @subcategory, @slug, @url, @country,
      @date_added, @date_last_verified, @status, @current_confidence
    )
  `);

  const insertCompany = db.prepare(`
    INSERT OR IGNORE INTO companies (
      id, name, entry_id, country, founded_date, status, sector, date_first_tracked
    ) VALUES (
      @id, @name, @entry_id, @country, @founded_date, @status, @sector, @date_first_tracked
    )
  `);

  const insertAudit = db.prepare(`
    INSERT OR IGNORE INTO audits (
      id, entry_id, audit_date, confidence_score, signals_found,
      signals_checked, action_taken, details, pr_number
    ) VALUES (
      @id, @entry_id, @audit_date, @confidence_score, @signals_found,
      @signals_checked, @action_taken, @details, @pr_number
    )
  `);

  const counts: Record<Collection, number> = {
    companies: 0,
    benchmarks: 0,
    'use-cases': 0,
    challenges: 0,
    resources: 0,
  };

  // Wrap everything in a single transaction for performance
  const runMigration = db.transaction(() => {
    for (const collection of COLLECTIONS) {
      const collectionDir = resolve(CONTENT_DIR, collection);

      if (!existsSync(collectionDir)) {
        console.log(`[skip] Directory not found: ${collectionDir}`);
        continue;
      }

      let files: string[];
      try {
        files = readdirSync(collectionDir).filter((f) => f.endsWith('.json'));
      } catch (err) {
        console.log(`[skip] Could not read directory ${collectionDir}: ${(err as Error).message}`);
        continue;
      }

      for (const file of files) {
        const filePath = resolve(collectionDir, file);
        let data: ContentEntry;

        try {
          const raw = readFileSync(filePath, 'utf-8');
          data = JSON.parse(raw) as ContentEntry;
        } catch (err) {
          console.warn(`[warn] Failed to parse ${filePath}: ${(err as Error).message}`);
          continue;
        }

        const entryId = uuid();
        const subcategory = getSubcategory(collection, data);
        const url = getUrl(data);
        const country = data.country ?? null;

        // Insert into entries
        insertEntry.run({
          id: entryId,
          name: data.name,
          collection,
          subcategory,
          slug: data.slug ?? basename(file, '.json'),
          url,
          country,
          date_added: TODAY,
          date_last_verified: TODAY,
          status: 'active',
          current_confidence: 'MEDIUM',
        });

        // For companies: also insert into companies table
        if (collection === 'companies') {
          insertCompany.run({
            id: uuid(),
            name: data.name,
            entry_id: entryId,
            country,
            founded_date: getFoundedDate(data.founded as number | string | undefined),
            status: 'active',
            sector: data.type ?? null,
            date_first_tracked: TODAY,
          });
        }

        // Insert audit row
        insertAudit.run({
          id: uuid(),
          entry_id: entryId,
          audit_date: TODAY,
          confidence_score: 'MEDIUM',
          signals_found: null,
          signals_checked: null,
          action_taken: 'migrated',
          details: `Migrated from ${file}`,
          pr_number: null,
        });

        counts[collection]++;
      }
    }
  });

  runMigration();
  db.close();

  // Summary
  console.log('\n── Migration complete ──────────────────────────────────');
  let total = 0;
  for (const collection of COLLECTIONS) {
    console.log(`  ${collection.padEnd(12)}: ${counts[collection]} entries`);
    total += counts[collection];
  }
  console.log(`  ${'total'.padEnd(12)}: ${total} entries`);
  console.log('────────────────────────────────────────────────────────\n');
}

migrate();
