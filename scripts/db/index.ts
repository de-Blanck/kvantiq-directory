import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { initializeSchema } from './schema.js';

export function getDb(): Database.Database {
  const dbPath = resolve(import.meta.dirname, '../../data/kvantiq.db');

  const db = new Database(dbPath);

  // Performance and safety pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Integrity check — throw on any corruption
  const result = db.pragma('integrity_check', { simple: true }) as string;
  if (result !== 'ok') {
    db.close();
    throw new Error(`SQLite integrity check failed: ${result}`);
  }

  initializeSchema(db);

  return db;
}

export { Database };
