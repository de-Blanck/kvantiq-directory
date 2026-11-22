export function getDomain(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

// Source-credibility blocklist (CLAUDE.md -> "Source credibility"). A news item
// whose link or named source is self-published / low-credibility is rejected
// even when its domain was a fetched source — so the methodology is enforced at
// the sweep, not just in human review. Matched on URL host (suffix) and on the
// source label. Exported for unit testing.
export const BLOCKLISTED_DOMAINS = [
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
