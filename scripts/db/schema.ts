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
      status              TEXT DEFAULT 'active',
      current_confidence  TEXT DEFAULT 'HIGH'
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS audits (
      id              TEXT PRIMARY KEY,
      entry_id        TEXT REFERENCES entries(id),
      audit_date      TEXT,
      confidence_score TEXT,
      signals_found   TEXT,
      signals_checked TEXT,
      action_taken    TEXT,
      details         TEXT,
      pr_number       INTEGER
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS category_proposals (
      id               TEXT PRIMARY KEY,
      proposed_name    TEXT,
      argument         TEXT,
      proposed_entries TEXT,
      status           TEXT DEFAULT 'pending',
      date_proposed    TEXT,
      date_resolved    TEXT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sources_checked (
      id                    TEXT PRIMARY KEY,
      audit_date            TEXT,
      source_name           TEXT,
      source_url            TEXT,
      entries_found         INTEGER DEFAULT 0,
      new_entries_discovered INTEGER DEFAULT 0
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
      status             TEXT DEFAULT 'active',
      sector             TEXT,
      date_first_tracked TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id            TEXT PRIMARY KEY,
      company_id    TEXT REFERENCES companies(id),
      event_date    TEXT,
      event_type    TEXT,
      headline      TEXT,
      details       TEXT,
      amount_eur    REAL,
      source_url    TEXT,
      confidence    TEXT DEFAULT 'verified',
      date_recorded TEXT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS market_snapshots (
      id                       TEXT PRIMARY KEY,
      snapshot_date            TEXT,
      total_companies_tracked  INTEGER,
      total_active             INTEGER,
      total_funding_eur_ytd    REAL,
      new_companies_ytd        INTEGER,
      closures_ytd             INTEGER,
      acquisitions_ytd         INTEGER,
      top_event_summary        TEXT,
      countries_represented    INTEGER
    );
  `);
}
