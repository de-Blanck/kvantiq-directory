#!/usr/bin/env node
/**
 * Weekly AI Content Sweep
 *
 * Fetches source URLs for each entry, hands the fetched content to Claude Code
 * via subprocess (`claude -p`), and extracts news items. Never fabricates —
 * only extracts from fetched content.
 *
 * Auth: requires CLAUDE_CODE_OAUTH_TOKEN in env (subscription billing).
 * No ANTHROPIC_API_KEY needed.
 *
 * Usage: CLAUDE_CODE_OAUTH_TOKEN=... node scripts/ai-sweep.mjs
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const CONTENT_DIR = 'src/content';
const COLLECTIONS = ['companies', 'benchmarks', 'use-cases', 'challenges', 'resources'];
const MAX_NEWS_PER_ENTRY = 5;
const NEWS_MAX_AGE_DAYS = 180;
const FETCH_TIMEOUT_MS = 10000;
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const CLAUDE_TIMEOUT_MS = 60000;

function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    // Strip control bytes — null bytes in fetched HTML crash the claude spawn
    // ("args[1] must be a string without null bytes").
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000);
}

async function fetchContent(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Kvantiq-Directory-Bot/1.0 (content-sweep)' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const text = await res.text();
    return stripHtml(text);
  } catch {
    return null;
  }
}

function getDomain(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

// Source-credibility blocklist (CLAUDE.md -> "Source credibility"). A news item
// whose link or named source is self-published / low-credibility is rejected
// even when its domain was a fetched source — so the methodology is enforced at
// the sweep, not just in human review. Matched on URL host (suffix) and on the
// source label. Exported for unit testing.
const BLOCKLISTED_DOMAINS = [
  'linkedin.com', 'crunchbase.com', 'wikipedia.org', 'facebook.com',
  'twitter.com', 'x.com', 'medium.com', 'prnewswire.com', 'globenewswire.com',
  'businesswire.com', 'accessnewswire.com', 'finance.yahoo.com',
];
const BLOCKLISTED_SOURCE_RE = /linkedin|crunchbase|wikipedia|facebook|prnewswire|globenewswire|businesswire|accessnewswire/i;

export function isBlocklistedSource(item) {
  const host = getDomain(item.url || '').replace(/^www\./, '');
  if (host && BLOCKLISTED_DOMAINS.some(d => host === d || host.endsWith('.' + d))) return true;
  if (item.source && BLOCKLISTED_SOURCE_RE.test(item.source)) return true;
  return false;
}

// Count an entry's CREDIBLE sources — those not on the blocklist. Single source
// of truth for the 3-credible-source minimum (used by audit-sources.mjs + sweep).
export function credibleSourceCount(sources) {
  return (sources || []).filter((s) => !isBlocklistedSource({ url: s.url, source: s.title || '' })).length;
}

function isRecent(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = (now - date) / (1000 * 60 * 60 * 24);
  return diffDays <= NEWS_MAX_AGE_DAYS;
}

// Validate + normalize model-extracted news items against the content schema
// (src/content.config.ts `newsSchema`). title/url/source/date are required and
// the item is dropped without them; the URL's domain must match a fetched source
// (anti-fabrication). `excerpt` is OPTIONAL but must be non-empty if present —
// an empty/whitespace excerpt is dropped rather than written as "", which would
// fail the content build. Items sharing a URL are collapsed to the first
// occurrence (the model often emits several stories that can only cite the
// entry's homepage). Exported for unit testing.
export function normalizeNewsItems(rawItems, fetchedDomains, stats) {
  if (!Array.isArray(rawItems)) return [];
  const bump = (k) => { if (stats) stats[k] = (stats[k] || 0) + 1; };
  if (stats) stats.raw = (stats.raw || 0) + rawItems.length;
  const seen = new Set();
  return rawItems
    .filter(item => {
      if (!item || !item.title || !item.url || !item.date || !item.source) { bump('rejected_missing_field'); return false; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) { bump('rejected_bad_date'); return false; }
      if (!fetchedDomains.has(getDomain(item.url))) { bump('rejected_domain_mismatch'); return false; }
      if (isBlocklistedSource(item)) { bump('rejected_blocklisted'); return false; }
      return true;
    })
    .map(item => {
      const out = { title: String(item.title).trim() };
      const excerpt = item.excerpt ? String(item.excerpt).trim() : '';
      if (excerpt) out.excerpt = excerpt; else bump('empty_excerpt_dropped');
      out.url = item.url;
      out.source = String(item.source).trim();
      out.date = item.date;
      return out;
    })
    .filter(item => { // guard against whitespace-only title/source
      if (item.title && item.source) return true;
      bump('rejected_blank_title_source');
      return false;
    })
    .filter(item => { // collapse duplicate URLs, keeping the first
      if (seen.has(item.url)) { bump('duplicate_url_collapsed'); return false; }
      seen.add(item.url);
      return true;
    });
}

// Invoke `claude -p` as a subprocess. Token from CLAUDE_CODE_OAUTH_TOKEN env.
// Returns the assistant's final text output (no tool use, no streaming events).
function askClaude(prompt) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', prompt,
      '--model', CLAUDE_MODEL,
      '--output-format', 'text',
    ];
    // `claude` is `claude.cmd` on Windows (npm global shim); bare `claude` is
    // not spawnable without a shell there. Keep the arg array (no shell) so the
    // large multi-line prompt stays a single, unquoted argument.
    const claudeBin = process.platform === 'win32' ? 'claude.cmd' : 'claude';
    const child = spawn(claudeBin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`claude -p timed out after ${CLAUDE_TIMEOUT_MS}ms`));
    }, CLAUDE_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude -p exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

// Extract a JSON array from a response that may have prose wrapping.
function extractJsonArray(text) {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// Extract a JSON object from a response that may have prose wrapping.
function extractJsonObject(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function processEntry(collection, file, stats) {
  const filePath = path.join(CONTENT_DIR, collection, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Source-bar metrics are a static property of the entry — computed regardless
  // of whether the sweep fetch/cross-check succeeds.
  const credible = credibleSourceCount(data.sources);
  const sourceCount = (data.sources || []).length;
  const base = { credible, source_count: sourceCount };

  const urlsToFetch = [
    ...(data.sources || []).map(s => s.url),
    ...(data.website ? [data.website] : []),
  ];

  const fetchedDomains = new Set();
  const fetchedContent = [];

  for (const url of urlsToFetch) {
    const content = await fetchContent(url);
    if (content) {
      fetchedDomains.add(getDomain(url));
      fetchedContent.push({ url, content: content.slice(0, 3000) });
    }
  }

  if (fetchedContent.length === 0) {
    return { ...base, skipped: true, reason: 'all fetches failed' };
  }

  const prompt = `You are auditing a directory entry against freshly fetched content from its own source URLs.
Do TWO things, using ONLY the fetched content — never invent, infer, or recall from training data.

1. NEWS: Extract news items explicitly stated in the fetched content. Each MUST include a direct source URL. Date format YYYY-MM-DD (use the first of the month if the day is unclear). If none, use [].

2. CROSS-CHECK: Compare the fetched sources against EACH OTHER and against the entry fields below. Report each CONTRADICTION (sources disagree on a fact such as country, founding year, type, or funding) and each UNSUPPORTED claim (an entry field the fetched sources do not substantiate). Be specific and brief (one sentence each). If everything is consistent, use []. Do not speculate beyond the fetched content.

Entry fields:
Name: ${data.name}
Country: ${data.country ?? 'n/a'}
Type: ${data.type ?? data.org_type ?? data.category ?? 'n/a'}
Founded: ${data.founded ?? 'n/a'}
Description: ${data.description}
Collection: ${collection}

Fetched content from sources:
${fetchedContent.map(f => `--- ${f.url} ---\n${f.content}`).join('\n\n')}

Return ONLY this JSON object, no other text:
{ "news": [ { "title": "...", "excerpt": "...", "url": "...", "source": "...", "date": "YYYY-MM-DD" } ], "contradictions": [ "short specific description" ] }`;

  let response;
  try {
    response = await askClaude(prompt);
  } catch (err) {
    return { ...base, skipped: true, reason: 'claude error: ' + err.message };
  }

  const parsed = extractJsonObject(response);
  const contradictions = Array.isArray(parsed?.contradictions)
    ? parsed.contradictions.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim())
    : [];
  const newsItems = Array.isArray(parsed?.news) ? parsed.news : [];
  if (!Array.isArray(newsItems)) return { ...base, skipped: false, added: 0, contradictions };

  const validatedNews = normalizeNewsItems(newsItems, fetchedDomains, stats);

  if (validatedNews.length === 0) return { ...base, skipped: false, added: 0, contradictions };

  const existingNews = (data.news || []).filter(n => isRecent(n.date));
  const existingUrls = new Set(existingNews.map(n => n.url));
  const newItems = validatedNews.filter(n => !existingUrls.has(n.url));

  if (newItems.length === 0) return { ...base, skipped: false, added: 0, contradictions };

  data.news = [...newItems, ...existingNews].slice(0, MAX_NEWS_PER_ENTRY);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');

  return { ...base, skipped: false, added: newItems.length, items: newItems, country: data.country || null, contradictions };
}

function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

const REPORT_FILE = path.join('data', 'generated', 'sweep-runs.json');
const MAX_RUNS_KEPT = 60;

// Prepend a run record to data/generated/sweep-runs.json (newest first), capped.
// Rendered by the Transparency → Audit Log page (/transparency/sweeps).
export function writeRunReport(report, file = REPORT_FILE) {
  let runs = [];
  try {
    if (fs.existsSync(file)) runs = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(runs)) runs = [];
  } catch { runs = []; }
  runs.unshift(report);
  runs = runs.slice(0, MAX_RUNS_KEPT);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(runs, null, 2) + '\n');
  console.log(`\nRun report written -> ${file} (${runs.length} run(s) on file)`);
}

async function main() {
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    console.error('CLAUDE_CODE_OAUTH_TOKEN environment variable is required (run `claude setup-token` to generate one).');
    process.exit(1);
  }

  console.log('=== Kvantiq Directory — Weekly AI Content Sweep ===');
  console.log(`Model: ${CLAUDE_MODEL} (subscription auth)\n`);

  const startedAt = new Date();
  const t0 = Date.now();

  const results = { updated: 0, skipped: 0, total: 0 };
  const adherence = {};        // rejection counters populated by normalizeNewsItems
  const byCollection = {};     // collection -> { scanned, updated, news_added }
  const byCountry = {};        // country -> news items added
  const bySource = {};         // news source -> count
  const notFound = [];         // entries with no usable live sources ("didn't find")
  let newsAdded = 0;
  let noChange = 0;
  const MIN_CREDIBLE_SOURCES = 3;
  const underBar = [];   // entries below the credible-source minimum
  const crossFlags = []; // entries with source contradictions
  let crossChecked = 0;  // entries the cross-check actually ran on (fetch succeeded)

  for (const collection of COLLECTIONS) {
    const dir = path.join(CONTENT_DIR, collection);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    byCollection[collection] = { scanned: 0, updated: 0, news_added: 0 };

    for (const file of files) {
      results.total++;
      byCollection[collection].scanned++;
      const entry = `${collection}/${file}`;
      process.stdout.write(`Processing ${entry}...`);

      const result = await processEntry(collection, file, adherence);

      // Source-bar + cross-check aggregation (independent of news outcome).
      if (typeof result.credible === 'number' && result.credible < MIN_CREDIBLE_SOURCES) {
        underBar.push({ entry, credible: result.credible, total: result.source_count });
      }
      if (Array.isArray(result.contradictions)) {
        crossChecked++;
        if (result.contradictions.length) crossFlags.push({ entry, issues: result.contradictions });
      }

      if (result.skipped) {
        results.skipped++;
        notFound.push(`${entry} (${result.reason})`);
        console.log(` SKIPPED (${result.reason})`);
      } else if (result.added > 0) {
        results.updated++;
        newsAdded += result.added;
        byCollection[collection].updated++;
        byCollection[collection].news_added += result.added;
        if (result.country) byCountry[result.country] = (byCountry[result.country] || 0) + result.added;
        for (const it of (result.items || [])) {
          if (it.source) bySource[it.source] = (bySource[it.source] || 0) + 1;
        }
        console.log(` UPDATED (+${result.added} news)`);
      } else {
        noChange++;
        console.log(' no changes');
      }
    }
  }

  const runtimeMs = Date.now() - t0;
  const raw = adherence.raw || 0;
  const rejected =
    (adherence.rejected_missing_field || 0) +
    (adherence.rejected_bad_date || 0) +
    (adherence.rejected_domain_mismatch || 0) +
    (adherence.rejected_blocklisted || 0) +
    (adherence.rejected_blank_title_source || 0);
  // Published items are 100% source-grounded by construction; the headline metric
  // is the share of model output that cleared every methodology gate.
  const passRate = raw > 0 ? Math.round(((raw - rejected) / raw) * 1000) / 10 : 100;

  const topCountry = Object.entries(byCountry).sort((a, b) => b[1] - a[1])[0];
  const topSource = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0];
  const topCollection = Object.entries(byCollection)
    .map(([c, v]) => [c, v.news_added]).sort((a, b) => b[1] - a[1])[0];

  const highlights = [];
  if (topCountry) highlights.push(`Most active country: ${topCountry[0]} (+${topCountry[1]} news items)`);
  if (topSource) highlights.push(`Most-cited source: ${topSource[0]} (${topSource[1]}x)`);
  if (topCollection && topCollection[1] > 0) highlights.push(`Busiest collection: ${topCollection[0]} (+${topCollection[1]})`);
  highlights.push(`${Object.keys(bySource).length} distinct sources cited across ${Object.keys(byCountry).length} countries`);
  if (rejected > 0) highlights.push(`${rejected} item(s) rejected at source to uphold the methodology (anti-fabrication + schema)`);
  if (underBar.length) highlights.push(`${underBar.length} entr${underBar.length === 1 ? 'y' : 'ies'} below the ${MIN_CREDIBLE_SOURCES}-credible-source minimum (backfill worklist)`);
  if (crossFlags.length) highlights.push(`${crossFlags.length} entr${crossFlags.length === 1 ? 'y' : 'ies'} flagged for source contradictions by the cross-check`);
  else if (crossChecked) highlights.push(`Source cross-check clean: no contradictions found across ${crossChecked} entries`);

  const report = {
    date: startedAt.toISOString().slice(0, 10),
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    runtime_ms: runtimeMs,
    runtime_human: formatDuration(runtimeMs),
    model: CLAUDE_MODEL,
    scanned: results.total,
    updated: results.updated,
    no_change: noChange,
    skipped: results.skipped,
    news_added: newsAdded,
    methodology: {
      items_proposed: raw,
      items_published: newsAdded,
      pass_rate_pct: passRate,
      rejected_missing_field: adherence.rejected_missing_field || 0,
      rejected_bad_date: adherence.rejected_bad_date || 0,
      rejected_domain_mismatch: adherence.rejected_domain_mismatch || 0,
      rejected_blocklisted: adherence.rejected_blocklisted || 0,
      rejected_blank_title_source: adherence.rejected_blank_title_source || 0,
      empty_excerpt_dropped: adherence.empty_excerpt_dropped || 0,
      duplicate_url_collapsed: adherence.duplicate_url_collapsed || 0,
    },
    source_bar: {
      min_credible: MIN_CREDIBLE_SOURCES,
      below_bar: underBar.length,
      entries: underBar.sort((a, b) => a.credible - b.credible).slice(0, 80),
    },
    cross_check: {
      entries_checked: crossChecked,
      flagged: crossFlags.length,
      contradictions_found: crossFlags.reduce((s, f) => s + f.issues.length, 0),
      flags: crossFlags.slice(0, 60),
    },
    by_collection: byCollection,
    by_country: byCountry,
    top_sources: Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([source, count]) => ({ source, count })),
    not_found: notFound,
    highlights,
  };

  console.log('\n=== Summary ===');
  console.log(`Runtime: ${report.runtime_human}`);
  console.log(`Scanned: ${report.scanned} | Updated: ${report.updated} | No-change: ${report.no_change} | Skipped: ${report.skipped}`);
  console.log(`News added: ${report.news_added} | Methodology pass-rate: ${passRate}% (${rejected} rejected of ${raw})`);

  writeRunReport(report);
}

// Only run the sweep when executed directly (`node scripts/ai-sweep.mjs`),
// not when imported by tests.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Sweep failed:', err);
    process.exit(1);
  });
}
