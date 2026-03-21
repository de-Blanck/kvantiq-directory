#!/usr/bin/env node
/**
 * Weekly AI Content Sweep
 *
 * Fetches source URLs for each entry, passes content to Claude API,
 * and extracts news items. Never fabricates — only extracts from fetched content.
 *
 * Usage: ANTHROPIC_API_KEY=sk-... node scripts/ai-sweep.mjs
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const CONTENT_DIR = 'src/content';
const COLLECTIONS = ['companies', 'benchmarks', 'use-cases', 'challenges', 'resources'];
const MAX_NEWS_PER_ENTRY = 5;
const NEWS_MAX_AGE_DAYS = 180; // 6 months
const FETCH_TIMEOUT_MS = 10000;

const client = new Anthropic();

// Strip HTML tags from fetched content
function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000); // Cap at 5000 chars per source
}

// Fetch URL content with timeout
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

// Extract domain from URL
function getDomain(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

// Check if date is within max age
function isRecent(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = (now - date) / (1000 * 60 * 60 * 24);
  return diffDays <= NEWS_MAX_AGE_DAYS;
}

// Process a single entry
async function processEntry(collection, file) {
  const filePath = path.join(CONTENT_DIR, collection, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Fetch content from all source URLs + website
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

  // If ALL fetches failed, skip this entry
  if (fetchedContent.length === 0) {
    return { skipped: true, reason: 'all fetches failed' };
  }

  // Ask Claude to extract news from fetched content
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

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text.trim();
    const newsItems = JSON.parse(text);

    if (!Array.isArray(newsItems)) return { skipped: false, added: 0 };

    // Validate: discard items with URLs not matching fetched source domains
    const validatedNews = newsItems.filter(item => {
      if (!item.title || !item.url || !item.date || !item.source) return false;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return false;
      const itemDomain = getDomain(item.url);
      return fetchedDomains.has(itemDomain);
    });

    if (validatedNews.length === 0) return { skipped: false, added: 0 };

    // Merge with existing news, prune old, cap at max
    const existingNews = (data.news || []).filter(n => isRecent(n.date));
    const existingUrls = new Set(existingNews.map(n => n.url));
    const newItems = validatedNews.filter(n => !existingUrls.has(n.url));

    if (newItems.length === 0) return { skipped: false, added: 0 };

    data.news = [...newItems, ...existingNews].slice(0, MAX_NEWS_PER_ENTRY);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');

    return { skipped: false, added: newItems.length };
  } catch (err) {
    return { skipped: true, reason: 'API error: ' + err.message };
  }
}

// Main
async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log('=== Kvantiq Directory — Weekly AI Content Sweep ===\n');

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

main().catch(err => {
  console.error('Sweep failed:', err);
  process.exit(1);
});
