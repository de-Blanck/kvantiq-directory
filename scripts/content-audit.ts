import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTENT_DIR = join(import.meta.dirname, '..', 'src', 'content');

interface AuditResult {
  collection: string;
  slug: string;
  rating: 'RICH' | 'ADEQUATE' | 'SPARSE';
  issues: string[];
}

function readJsonDir(dir: string): { slug: string; data: Record<string, unknown> }[] {
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const data = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
    return { slug: data.slug || f.replace('.json', ''), data };
  });
}

function auditCompany(data: Record<string, unknown>): AuditResult {
  const issues: string[] = [];
  const desc = String(data.description || '');
  if (desc.length < 80) issues.push(`description too short (${desc.length} chars, need 80+)`);
  if (!data.employees && !data.funding) issues.push('missing both employees and funding');
  const hasProducts = Array.isArray(data.products) && data.products.length > 0;
  const hasHighlights = Array.isArray(data.highlights) && data.highlights.length > 0;
  const rating = issues.length > 0 ? 'SPARSE'
    : (hasProducts && hasHighlights) ? 'RICH'
    : 'ADEQUATE';
  return { collection: 'companies', slug: String(data.slug), rating, issues };
}

function auditBenchmark(data: Record<string, unknown>): AuditResult {
  const issues: string[] = [];
  const desc = String(data.description || '');
  if (desc.length < 80) issues.push(`description too short (${desc.length} chars, need 80+)`);
  if (!data.hardware) issues.push('missing hardware');
  const rating = issues.length > 0 ? 'SPARSE' : 'ADEQUATE';
  return { collection: 'benchmarks', slug: String(data.slug), rating, issues };
}

function auditUseCase(data: Record<string, unknown>): AuditResult {
  const issues: string[] = [];
  const desc = String(data.description || '');
  if (desc.length < 80) issues.push(`description too short (${desc.length} chars, need 80+)`);
  if (!data.results) issues.push('missing results');
  const hasCompanies = Array.isArray(data.companies) && data.companies.length > 0;
  const rating = issues.length > 0 ? 'SPARSE'
    : hasCompanies ? 'RICH'
    : 'ADEQUATE';
  return { collection: 'use-cases', slug: String(data.slug), rating, issues };
}

function auditChallenge(data: Record<string, unknown>): AuditResult {
  const issues: string[] = [];
  const desc = String(data.description || '');
  if (desc.length < 80) issues.push(`description too short (${desc.length} chars, need 80+)`);
  if (!data.prizes) issues.push('missing prizes');
  if (!data.dateStart) issues.push('missing dateStart');
  const hasEligibility = !!data.eligibility;
  const hasDomains = Array.isArray(data.problemDomains) && data.problemDomains.length > 0;
  const rating = issues.length > 0 ? 'SPARSE'
    : (hasEligibility && hasDomains) ? 'RICH'
    : 'ADEQUATE';
  return { collection: 'challenges', slug: String(data.slug), rating, issues };
}

function auditResource(data: Record<string, unknown>): AuditResult {
  const issues: string[] = [];
  const desc = String(data.description || '');
  if (desc.length < 80) issues.push(`description too short (${desc.length} chars, need 80+)`);
  const hasLastUpdated = !!data.lastUpdated;
  const hasMaturity = !!data.maturity;
  const rating = issues.length > 0 ? 'SPARSE'
    : (hasLastUpdated && hasMaturity) ? 'RICH'
    : 'ADEQUATE';
  return { collection: 'resources', slug: String(data.slug), rating, issues };
}

// Run audit
const results: AuditResult[] = [];

for (const entry of readJsonDir(join(CONTENT_DIR, 'companies'))) results.push(auditCompany(entry.data));
for (const entry of readJsonDir(join(CONTENT_DIR, 'benchmarks'))) results.push(auditBenchmark(entry.data));
for (const entry of readJsonDir(join(CONTENT_DIR, 'use-cases'))) results.push(auditUseCase(entry.data));
for (const entry of readJsonDir(join(CONTENT_DIR, 'challenges'))) results.push(auditChallenge(entry.data));
for (const entry of readJsonDir(join(CONTENT_DIR, 'resources'))) results.push(auditResource(entry.data));

// Summary
const counts = { RICH: 0, ADEQUATE: 0, SPARSE: 0 };
for (const r of results) counts[r.rating]++;

console.log('\n=== CONTENT QUALITY AUDIT ===\n');
console.log(`Total entries: ${results.length}`);
console.log(`  RICH:     ${counts.RICH}`);
console.log(`  ADEQUATE: ${counts.ADEQUATE}`);
console.log(`  SPARSE:   ${counts.SPARSE}`);

// Per-collection breakdown
const collections = ['companies', 'benchmarks', 'use-cases', 'challenges', 'resources'];
for (const col of collections) {
  const colResults = results.filter(r => r.collection === col);
  const colCounts = { RICH: 0, ADEQUATE: 0, SPARSE: 0 };
  for (const r of colResults) colCounts[r.rating]++;
  console.log(`\n--- ${col} (${colResults.length}) ---`);
  console.log(`  RICH: ${colCounts.RICH}  ADEQUATE: ${colCounts.ADEQUATE}  SPARSE: ${colCounts.SPARSE}`);
}

// List SPARSE entries
const sparse = results.filter(r => r.rating === 'SPARSE');
if (sparse.length > 0) {
  console.log('\n=== ENTRIES BELOW ADEQUATE THRESHOLD ===\n');
  for (const r of sparse) {
    console.log(`  [${r.collection}] ${r.slug}`);
    for (const issue of r.issues) console.log(`    - ${issue}`);
  }
}

console.log('\n');
