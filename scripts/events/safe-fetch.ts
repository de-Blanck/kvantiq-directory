import { lookup as dnsLookup } from 'node:dns/promises';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { Readable } from 'node:stream';
import type { FetchedPage } from './check';

type Lookup = (host: string) => Promise<string[]>;
type FetchOptions = {
  lookup?: Lookup;
  fetchImpl?: typeof fetch;
  maxHops?: number;
  maxBytes?: number;
  timeoutMs?: number;
  userAgent: string;
};
type PageResponse = {
  status: number;
  headers: Pick<Headers, 'get'>;
  body: ReadableStream<Uint8Array> | null;
};

const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
] as const) blocked.addSubnet(network, prefix, 'ipv4');

const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
for (const [network, prefix] of [
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20],
] as const) blocked.addSubnet(network, prefix, 'ipv6');

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  if (family !== 6 || address.includes('%')) return false;

  // WHATWG serialization makes both dotted and hexadecimal mapped addresses comparable.
  const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  if (normalized.startsWith('::ffff:')) {
    const words = normalized.slice('::ffff:'.length).split(':').map(word => Number.parseInt(word, 16));
    const ipv4 = words.flatMap(word => [word >> 8, word & 255]).join('.');
    return !blocked.check(ipv4, 'ipv4');
  }
  return globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

const defaultLookup: Lookup = async host => (await dnsLookup(host, { all: true })).map(result => result.address);

async function publicAddresses(url: URL, lookup: Lookup): Promise<string[]> {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Expected an HTTP(S) URL without credentials');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  const literal = isIP(host);
  if (!literal && (host === 'localhost' || !host.includes('.') || /\.(?:local|internal|localhost)$/.test(host))) {
    throw new Error('Expected a public hostname');
  }

  const addresses = literal ? [host] : await lookup(url.hostname);
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
    throw new Error('Expected public IP addresses');
  }
  return addresses;
}

export async function assertPublicHttpUrl(url: string, lookup = defaultLookup): Promise<void> {
  await publicAddresses(new URL(url), lookup);
}

function fetchPinned(url: URL, addresses: string[], signal: AbortSignal, userAgent: string): Promise<PageResponse> {
  const get = url.protocol === 'https:' ? httpsGet : httpGet;
  const resolved = addresses.map(address => ({ address, family: isIP(address) }));
  return new Promise((resolve, reject) => {
    // Keep the URL hostname for Host and TLS verification, but connect only to validated addresses.
    const request = get(url, {
      agent: false,
      signal,
      headers: { 'User-Agent': userAgent, 'Accept-Encoding': 'identity' },
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, resolved);
        else callback(null, resolved[0].address, resolved[0].family);
      },
    }, response => {
      resolve({
        status: response.statusCode ?? 0,
        headers: {
          get(name) {
            const values = response.headersDistinct[name];
            return values?.length === 1 ? values[0] : null;
          },
        },
        body: Readable.toWeb(response, {
          strategy: { highWaterMark: response.readableHighWaterMark, size: (chunk: Uint8Array) => chunk.byteLength },
        }) as ReadableStream<Uint8Array>,
      });
    });
    request.on('error', reject);
  });
}

async function readBody(body: PageResponse['body'], maxBytes: number, signal: AbortSignal): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  const decoder = new TextDecoder();
  let html = '';
  let remaining = maxBytes;
  try {
    while (remaining > 0) {
      const { value, done } = await reader.read();
      if (done) break;
      html += decoder.decode(value.subarray(0, remaining), { stream: true });
      remaining -= value.byteLength;
    }
    return html + decoder.decode();
  } finally {
    signal.removeEventListener('abort', cancel);
    if (remaining <= 0) cancel();
    reader.releaseLock();
  }
}

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

export async function safeFetch(url: string, opts: FetchOptions): Promise<FetchedPage> {
  const { lookup = defaultLookup, fetchImpl, maxHops = 5, maxBytes = 2_000_000, timeoutMs = 20_000, userAgent } = opts;
  let finalUrl = url;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const { signal } = controller;

  async function fetchPage(): Promise<FetchedPage> {
    for (let hops = 0; ; hops++) {
      const current = new URL(finalUrl);
      const addresses = await publicAddresses(current, lookup);
      signal.throwIfAborted();
      const response = fetchImpl
        ? await fetchImpl(finalUrl, { redirect: 'manual', signal, headers: { 'User-Agent': userAgent } })
        : await fetchPinned(current, addresses, signal, userAgent);
      const location = response.headers.get('location');
      const redirect = location !== null && redirectStatuses.has(response.status);
      if (signal.aborted || redirect) void response.body?.cancel().catch(() => {});
      signal.throwIfAborted();
      if (redirect) {
        finalUrl = new URL(location, current).href;
        if (hops >= maxHops) throw new Error('Too many redirects');
        continue;
      }
      return {
        status: response.status,
        contentType: response.headers.get('content-type') ?? '',
        html: await readBody(response.body, maxBytes, signal),
        finalUrl,
      };
    }
  }

  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(signal.reason);
      }, timeoutMs);
    });
    return await Promise.race([fetchPage(), timeout]);
  } catch {
    return { status: 0, contentType: '', html: '', finalUrl };
  } finally {
    clearTimeout(timer);
  }
}
