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

function isRecent(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = (now - date) / (1000 * 60 * 60 * 24);
  return diffDays <= NEWS_MAX_AGE_DAYS;
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

// Normalize a model-emitted news item: trim string fields and drop an empty or
// whitespace-only excerpt. The content schema makes `excerpt` optional but
// rejects empty strings (nonEmpty), so emitting "" fails build-time validation
// and FATALs the weekly runner. Omitting the field keeps the item schema-valid.
export function normalizeNewsItem(item) {
  if (!item || typeof item !== 'object') return {};
  const out = { ...item };
  for (const k of ['title', 'excerpt', 'url', 'source', 'date']) {
    if (typeof out[k] === 'string') out[k] = out[k].trim();
  }
  if (!out.excerpt) delete out.excerpt;
  return out;
}

// Dedupe news items by URL, preserving order and skipping any URL already seen.
// The model sometimes emits several items pointing at the same (often homepage)
// URL when that is the only fetched source; collapse them to one.
export function dedupeByUrl(items, seenUrls = new Set()) {
  const out = [];
  for (const item of items) {
    if (seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    out.push(item);
  }
  return out;
}

async function processEntry(collection, file) {
  const filePath = path.join(CONTENT_DIR, collection, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

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
    return { skipped: true, reason: 'all fetches failed' };
  }

  const prompt = `You are given the current directory entry and freshly fetched content from its source URLs.
Extract ONLY news items that are explicitly stated in the provided content.
Do NOT invent, infer, or recall information from your training data.
If the fetched content contains no news, return an empty array.
Each news item MUST include a direct URL to the source page where you found it.
Date format: YYYY-MM-DD. If exact date is unclear, use the first of the month.

Current entry:
Name: ${data.name}
Description: ${data.description}
Collection: ${collection}

Fetched content from sources:
${fetchedContent.map(f => `--- ${f.url} ---\n${f.content}`).join('\n\n')}

Return a JSON array of news items. Each item: { "title": "...", "excerpt": "...", "url": "...", "source": "...", "date": "YYYY-MM-DD" }
Return ONLY the JSON array, no other text. If no news found, return [].`;

  let response;
  try {
    response = await askClaude(prompt);
  } catch (err) {
    return { skipped: true, reason: 'claude error: ' + err.message };
  }

  const newsItems = extractJsonArray(response);
  if (!Array.isArray(newsItems)) return { skipped: false, added: 0 };

  const validatedNews = newsItems.map(normalizeNewsItem).filter(item => {
    if (!item.title || !item.url || !item.date || !item.source) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return false;
    const itemDomain = getDomain(item.url);
    return fetchedDomains.has(itemDomain);
  });

  if (validatedNews.length === 0) return { skipped: false, added: 0 };

  const existingNews = (data.news || []).filter(n => isRecent(n.date));
  const existingUrls = new Set(existingNews.map(n => n.url));
  // Dedupe within the batch and against existing entry news in one pass.
  const newItems = dedupeByUrl(validatedNews, new Set(existingUrls));

  if (newItems.length === 0) return { skipped: false, added: 0 };

  data.news = [...newItems, ...existingNews].slice(0, MAX_NEWS_PER_ENTRY);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');

  return { skipped: false, added: newItems.length };
}

async function main() {
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    console.error('CLAUDE_CODE_OAUTH_TOKEN environment variable is required (run `claude setup-token` to generate one).');
    process.exit(1);
  }

  console.log('=== Kvantiq Directory — Weekly AI Content Sweep ===');
  console.log(`Model: ${CLAUDE_MODEL} (subscription auth)\n`);

  const results = { updated: 0, skipped: 0, total: 0, details: [] };

  for (const collection of COLLECTIONS) {
    const dir = path.join(CONTENT_DIR, collection);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      results.total++;
      const entry = `${collection}/${file}`;
      process.stdout.write(`Processing ${entry}...`);

      const result = await processEntry(collection, file);

      if (result.skipped) {
        results.skipped++;
        results.details.push({ entry, status: 'skipped', reason: result.reason });
        console.log(` SKIPPED (${result.reason})`);
      } else if (result.added > 0) {
        results.updated++;
        results.details.push({ entry, status: 'updated', added: result.added });
        console.log(` UPDATED (+${result.added} news)`);
      } else {
        console.log(' no changes');
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total entries: ${results.total}`);
  console.log(`Updated: ${results.updated}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Unchanged: ${results.total - results.updated - results.skipped}`);

  if (results.details.length > 0) {
    console.log('\n=== Changes ===');
    results.details.forEach(d => {
      console.log(`  ${d.entry}: ${d.status}${d.added ? ' (+' + d.added + ' news)' : ''}${d.reason ? ' (' + d.reason + ')' : ''}`);
    });
  }
}

// Only run the sweep when invoked directly — allows importing the pure helpers
// (normalizeNewsItem, dedupeByUrl) from tests without triggering a real run.
import { pathToFileURL } from 'url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('Sweep failed:', err);
    process.exit(1);
  });
}
