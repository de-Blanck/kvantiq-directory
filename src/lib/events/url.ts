export function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  parsed.hash = '';
  for (const key of new Set(parsed.searchParams.keys())) {
    if (/^utm_/i.test(key)) parsed.searchParams.delete(key);
  }
  if (parsed.pathname !== '/') parsed.pathname = parsed.pathname.replace(/\/$/, '');
  return parsed.href;
}

export function hostOf(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname;
  } catch {
    return '';
  }
}

export function isHostOrSubdomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith('.' + domain);
}
