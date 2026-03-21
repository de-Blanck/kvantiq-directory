import Database from 'better-sqlite3';

export function initializeSchema(db: Database.Database): void {
  // ── Layer 1: QA/QC ────────────────────────────────────────────────────────

  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      collection          TEXT NOT NULL,
      subcategory         TEXT,
      slug                TEXT NOT NULL,
      url                 TEXT,
      country             TEXT,
      date_added          TEXT NOT NULL,
      date_last_verified  TEXT,
      status              TEXT NOT NULL DEFAULT 'active',
      current_confidence  TEXT NOT NULL DEFAULT 'HIGH'
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS audits (
      id              TEXT PRIMARY KEY,
      entry_id        TEXT NOT NULL REFERENCES entries(id),
      audit_date      TEXT NOT NULL,
      confidence_score TEXT NOT NULL,
      signals_found   TEXT NOT NULL,
      signals_checked TEXT NOT NULL,
      action_taken    TEXT NOT NULL,
      details         TEXT,
      pr_number       INTEGER
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS category_proposals (
      id               TEXT PRIMARY KEY,
      proposed_name    TEXT NOT NULL,
      argument         TEXT NOT NULL,
      proposed_entries TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'pending',
      date_proposed    TEXT NOT NULL,
      date_resolved    TEXT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sources_checked (
      id                    TEXT PRIMARY KEY,
      audit_date            TEXT NOT NULL,
      source_name           TEXT NOT NULL,
      source_url            TEXT,
      entries_found         INTEGER NOT NULL DEFAULT 0,
      new_entries_discovered INTEGER NOT NULL DEFAULT 0
    );
  `);

  // ── Layer 2: Intelligence ─────────────────────────────────────────────────

  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id                 TEXT PRIMARY KEY,
      name               TEXT NOT NULL,
      entry_id           TEXT REFERENCES entries(id),
      country            TEXT,
      founded_date       TEXT,
      status             TEXT NOT NULL DEFAULT 'active',
      sector             TEXT,
      date_first_tracked TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id            TEXT PRIMARY KEY,
      company_id    TEXT NOT NULL REFERENCES companies(id),
      event_date    TEXT NOT NULL,
      event_type    TEXT NOT NULL,
      headline      TEXT NOT NULL,
      details       TEXT,
      amount_eur    REAL,
      source_url    TEXT,
      confidence    TEXT NOT NULL DEFAULT 'verified',
      date_recorded TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS market_snapshots (
      id                       TEXT PRIMARY KEY,
      snapshot_date            TEXT NOT NULL,
      total_companies_tracked  INTEGER NOT NULL,
      total_active             INTEGER NOT NULL,
      total_funding_eur_ytd    REAL,
      new_companies_ytd        INTEGER,
      closures_ytd             INTEGER,
      acquisitions_ytd         INTEGER,
      top_event_summary        TEXT,
      countries_represented    INTEGER
    );
  `);
}
