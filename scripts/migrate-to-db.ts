import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, basename } from 'path';
import { execSync } from 'child_process';
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

// Try worktree first (canonical location), fall back to repo root
const WORKTREE_CONTENT = resolve(import.meta.dirname, '../.worktrees/feature-directory-site/src/content');
const ROOT_CONTENT = resolve(import.meta.dirname, '../src/content');
const CONTENT_DIR = existsSync(WORKTREE_CONTENT) ? WORKTREE_CONTENT : ROOT_CONTENT;

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
  const year = String(founded);
  // Normalize to ISO 8601 date format
  return year.length === 4 ? `${year}-01-01` : year;
}

function getGitCreationDate(filePath: string): string | null {
  try {
    const result = execSync(
      `git log --follow --format=%aI --diff-filter=A -- "${filePath.replace(/\\/g, '/')}"`,
      { encoding: 'utf-8', cwd: CONTENT_DIR }
    ).trim();
    if (result) {
      // Take the last line (oldest commit) and extract date portion
      const lines = result.split('\n');
      const oldest = lines[lines.length - 1];
      return oldest.slice(0, 10);
    }
  } catch {
    // git not available or file not tracked
  }
  return null;
}

// ── First-seen ledger ────────────────────────────────────────────────────────
// `date_added` drives the Directory Growth chart on /transparency/audit/, and git
// history is the only place the real dates live. But the deploy upload excludes
// `.git` (see .vercelignore), so on Vercel every `git log` above returns nothing
// and every entry would be dated the build day — the chart collapsed to a single
// point in production until 2026-09-06.
//
// So the dates are resolved once, where history exists, and committed to
// data/entry-first-seen.json. The ledger is authoritative; git is only consulted
// for slugs the ledger has never seen, and an entry's date never moves once written.
const LEDGER_PATH = resolve(import.meta.dirname, '../data/entry-first-seen.json');

type FirstSeenLedger = Record<string, string>;

function loadLedger(): FirstSeenLedger {
  if (!existsSync(LEDGER_PATH)) return {};
  try {
    const parsed = JSON.parse(readFileSync(LEDGER_PATH, 'utf-8')) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as FirstSeenLedger;
    }
    console.warn('[warn] entry-first-seen.json is not an object — starting a new ledger');
  } catch (err) {
    console.warn(`[warn] Could not read entry-first-seen.json: ${(err as Error).message}`);
  }
  return {};
}

function saveLedger(ledger: FirstSeenLedger): void {
  const sorted = Object.fromEntries(
    Object.entries(ledger).sort(([a], [b]) => a.localeCompare(b))
  );
  mkdirSync(resolve(LEDGER_PATH, '..'), { recursive: true });
  writeFileSync(LEDGER_PATH, JSON.stringify(sorted, null, 2) + '\n');
}

function hasGitHistory(): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      encoding: 'utf-8',
      cwd: CONTENT_DIR,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function migrate(): void {
  const db = getDb();

  console.log(`[migrate] Content directory: ${CONTENT_DIR}`);

  const ledger = loadLedger();
  const ledgerSizeBefore = Object.keys(ledger).length;
  const gitHistory = hasGitHistory();
  let newlyLedgered = 0;
  console.log(
    `[migrate] First-seen ledger: ${ledgerSizeBefore} known slugs` +
      (gitHistory ? '' : ' (no git history here — unknown slugs fall back to today)')
  );

  // Check for existing entries to skip (idempotency via unique index)
  const existingCount = (db.prepare('SELECT COUNT(*) AS c FROM entries').get() as { c: number }).c;
  if (existingCount > 0) {
    console.log(`[migrate] Database already has ${existingCount} entries. INSERT OR IGNORE will skip duplicates.`);
  }

  // Prepared statements — INSERT OR IGNORE relies on UNIQUE(collection, slug) index
  const insertEntry = db.prepare(`
    INSERT OR IGNORE INTO entries (
      id, name, collection, subcategory, slug, url, country,
      date_added, date_last_verified, status, current_confidence
    ) VALUES (
      @id, @name, @collection, @subcategory, @slug, @url, @country,
      @date_added, @date_last_verified, @status, @current_confidence
    )
  `);

  // Look up entry by collection+slug to get the id for company/audit inserts
  const findEntry = db.prepare(
    'SELECT id FROM entries WHERE collection = @collection AND slug = @slug'
  );

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

        const slug = data.slug ?? basename(file, '.json');
        const subcategory = getSubcategory(collection, data);
        const url = getUrl(data);
        const country = data.country ?? null;
        const ledgerKey = `${collection}/${slug}`;
        const dateAdded =
          ledger[ledgerKey] ??
          (gitHistory ? getGitCreationDate(resolve(collectionDir, file)) : null) ??
          TODAY;
        if (ledger[ledgerKey] !== dateAdded) {
          ledger[ledgerKey] = dateAdded;
          newlyLedgered++;
        }

        // Insert into entries (skips if collection+slug already exists)
        const newId = uuid();
        const changes = insertEntry.run({
          id: newId,
          name: data.name,
          collection,
          subcategory,
          slug,
          url,
          country,
          date_added: dateAdded,
          date_last_verified: TODAY,
          status: 'active',
          current_confidence: 'MEDIUM',
        });

        // If INSERT was ignored (duplicate), skip company/audit inserts too
        if (changes.changes === 0) continue;

        // Resolve the actual entry ID (could be new or existing)
        const entryRow = findEntry.get({ collection, slug }) as { id: string } | undefined;
        const entryId = entryRow?.id ?? newId;

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
            date_first_tracked: dateAdded,
          });
        }

        // Insert initial audit row
        insertAudit.run({
          id: uuid(),
          entry_id: entryId,
          audit_date: TODAY,
          confidence_score: 'MEDIUM',
          signals_found: '[]',
          signals_checked: '[]',
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

  saveLedger(ledger);
  if (newlyLedgered > 0) {
    console.log(
      `[migrate] First-seen ledger: +${newlyLedgered} slug(s) dated ` +
        `${gitHistory ? 'from git history' : `${TODAY} (no git history)`} — commit data/entry-first-seen.json`
    );
  }

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
