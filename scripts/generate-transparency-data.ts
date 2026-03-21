import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { getDb } from './db/index.js';

const OUTPUT_DIR = resolve(import.meta.dirname, '../data/generated');
mkdirSync(OUTPUT_DIR, { recursive: true });

function writeJson(filename: string, data: unknown) {
  writeFileSync(resolve(OUTPUT_DIR, filename), JSON.stringify(data, null, 2));
  console.log(`  Generated: ${filename}`);
}

const db = getDb();

try {
  console.log('Generating transparency data...\n');

  // 1. confidence-distribution.json
  const confidenceDistribution = db
    .prepare(
      `SELECT current_confidence AS label, COUNT(*) AS value
       FROM entries
       WHERE status = 'active'
       GROUP BY current_confidence`
    )
    .all();
  writeJson('confidence-distribution.json', confidenceDistribution);

  // 2. entry-timeline.json
  const entryTimeline = db
    .prepare(
      `SELECT date(date_added) AS date, collection, COUNT(*) AS count
       FROM entries
       GROUP BY date(date_added), collection
       ORDER BY date(date_added)`
    )
    .all();
  writeJson('entry-timeline.json', entryTimeline);

  // 3. audit-summary.json — last 4 weeks (28 days)
  const auditCutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const auditSummary = db
    .prepare(
      `SELECT action_taken, COUNT(*) AS count
       FROM audits
       WHERE audit_date >= ?
       GROUP BY action_taken`
    )
    .all(auditCutoff);
  writeJson('audit-summary.json', auditSummary);

  // 4. coverage-map.json
  const coverageMap = db
    .prepare(
      `SELECT country, COUNT(*) AS count
       FROM entries
       WHERE status = 'active' AND country IS NOT NULL
       GROUP BY country
       ORDER BY count DESC`
    )
    .all();
  writeJson('coverage-map.json', coverageMap);

  // 5. funding-timeline.json
  const fundingTimeline = db
    .prepare(
      `SELECT
         strftime('%Y', event_date) || '-Q' ||
           ((cast(strftime('%m', event_date) AS integer) - 1) / 3 + 1) AS quarter,
         SUM(amount_eur) AS total_eur,
         COUNT(*) AS deal_count
       FROM events
       WHERE event_type = 'funding' AND amount_eur IS NOT NULL
       GROUP BY quarter
       ORDER BY quarter`
    )
    .all();
  writeJson('funding-timeline.json', fundingTimeline);

  // 6. events.json — last 90 days joined with company names, latest 50
  const eventsCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const events = db
    .prepare(
      `SELECT e.*, c.name AS company_name
       FROM events e
       JOIN companies c ON e.company_id = c.id
       WHERE e.date_recorded >= ?
       ORDER BY e.event_date DESC
       LIMIT 50`
    )
    .all(eventsCutoff);
  writeJson('events.json', events);

  // 7. market-snapshot.json — latest snapshot, fallback to empty object
  const marketSnapshot =
    db
      .prepare(
        `SELECT * FROM market_snapshots ORDER BY snapshot_date DESC LIMIT 1`
      )
      .get() ?? {};
  writeJson('market-snapshot.json', marketSnapshot);

  // 8. source-effectiveness.json
  const sourceEffectiveness = db
    .prepare(
      `SELECT
         source_name,
         SUM(entries_found) AS total_found,
         SUM(new_entries_discovered) AS total_new
       FROM sources_checked
       GROUP BY source_name
       ORDER BY total_new DESC`
    )
    .all();
  writeJson('source-effectiveness.json', sourceEffectiveness);

  // 9. entry-audits.json — per-entry audit history for detail pages
  const entryAudits = db
    .prepare(
      `SELECT
         e.slug,
         e.collection,
         e.current_confidence,
         e.date_last_verified,
         json_group_array(
           json_object(
             'date', a.audit_date,
             'confidence', a.confidence_score,
             'action', a.action_taken,
             'details', a.details
           )
         ) AS audit_history
       FROM entries e
       LEFT JOIN audits a ON a.entry_id = e.id
       WHERE e.status = 'active'
       GROUP BY e.id`
    )
    .all() as Array<Record<string, unknown>>;

  // audit_history is a JSON string from json_group_array — parse it
  const entryAuditsParsed = entryAudits.map((row) => ({
    ...row,
    audit_history:
      typeof row.audit_history === 'string'
        ? JSON.parse(row.audit_history)
        : row.audit_history,
  }));
  writeJson('entry-audits.json', entryAuditsParsed);

  console.log('\nDone. 9 files written to data/generated/');
} finally {
  db.close();
}
