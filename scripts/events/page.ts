import { isoDate } from '../../src/lib/events/schema';

const blockTags = /^(?:p|div|li|h[1-6]|td|th|tr|br|section|article|header|footer|nav|blockquote)$/;
const voidTags = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;
const excludedTags = /^(?:head|script|style|noscript|template)$/;
const namedEntities: Record<string, string> = {
  amp: '&', apos: "'", quot: '"', lt: '<', gt: '>', nbsp: ' ',
  ensp: ' ', emsp: ' ', thinsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»',
  euro: '€', pound: '£', dollar: '$', cent: '¢', copy: '©', reg: '®',
  trade: '™', middot: '·', bull: '•', times: '×', minus: '−', para: '¶',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]*);/gi, (entity, name: string) => {
    if (!name.startsWith('#')) {
      return Object.hasOwn(namedEntities, name) ? namedEntities[name] : entity;
    }
    const hex = name[1].toLowerCase() === 'x';
    const codePoint = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
    if (codePoint === 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return '�';
    return String.fromCodePoint(codePoint);
  });
}

function attributes(tag: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const body = tag.replace(/^<\/?[\w:-]+/, '').slice(0, -1);
  for (const [, name, double, single, unquoted] of body.matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const key = name.toLowerCase();
    if (!attrs.has(key)) attrs.set(key, decodeEntities(double ?? single ?? unquoted ?? ''));
  }
  return attrs;
}

export function htmlToText(html: string): string {
  const tokens = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?[a-z][\w:-]*(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
  const openTags: { name: string; hidden: boolean }[] = [];
  let hiddenDepth = 0;
  let offset = 0;
  let text = '';

  for (let match = tokens.exec(html); match; match = tokens.exec(html)) {
    if (!hiddenDepth) text += decodeEntities(html.slice(offset, match.index));
    const tag = match[0];
    offset = tokens.lastIndex;
    const parts = /^<(\/?)([\w:-]+)/.exec(tag);
    if (!parts) continue;
    const [, closing, rawName] = parts;
    const name = rawName.toLowerCase();
    const visibleBefore = hiddenDepth === 0;

    if (closing) {
      const index = openTags.findLastIndex(open => open.name === name);
      if (index !== -1) {
        for (const open of openTags.splice(index)) {
          if (open.hidden) hiddenDepth--;
        }
      }
    } else if (/^(?:script|style)$/.test(name)) {
      // Raw text can contain strings that resemble closing tags for other elements.
      const end = new RegExp(`</${name}\\s*>`, 'gi');
      end.lastIndex = offset;
      offset = end.exec(html) ? end.lastIndex : html.length;
      tokens.lastIndex = offset;
    } else if (!voidTags.test(name)) {
      const attrs = attributes(tag);
      const hidden = excludedTags.test(name) || attrs.has('hidden') ||
        attrs.get('aria-hidden')?.trim().toLowerCase() === 'true' ||
        /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(attrs.get('style') ?? '');
      openTags.push({ name, hidden });
      if (hidden) hiddenDepth++;
    }

    if (blockTags.test(name) && (visibleBefore || !hiddenDepth)) text += ' ¶ ';
  }
  if (!hiddenDepth) text += decodeEntities(html.slice(offset));
  return text.replace(/\s+/g, ' ').replace(/\s*¶\s*/g, ' ¶ ');
}

export function normalizeForMatch(s: string): string {
  return s.normalize('NFKC').toLowerCase()
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ').trim();
}

export function quoteFound(quote: string, pageText: string): boolean {
  const normalized = normalizeForMatch(quote);
  return normalized.length >= 20 && !normalized.includes('¶') &&
    normalizeForMatch(pageText).includes(normalized);
}

const articleTypes = new Set(['NewsArticle', 'Article', 'BlogPosting', 'PressRelease', 'Report']);

export function publishedDates(html: string): string[] {
  const dates = new Set<string>();
  function addDate(value: unknown) {
    if (typeof value !== 'string') return;
    const date = /^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/.exec(value.trim())?.[1];
    if (date && isoDate.safeParse(date).success) dates.add(date);
  }

  function readJsonLd(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach(readJsonLd);
    } else if (value && typeof value === 'object') {
      const article = value as Record<string, unknown>;
      const types = Array.isArray(article['@type']) ? article['@type'] : [article['@type']];
      if (types.some(type => typeof type === 'string' && articleTypes.has(type))) addDate(article.datePublished);
      readJsonLd(article['@graph']);
    }
  }

  const elements = /<!--[\s\S]*?(?:-->|$)|<script\b(?:"[^"]*"|'[^']*'|[^'">])*?>[\s\S]*?<\/script\s*>|<meta\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
  for (const [element] of html.matchAll(elements)) {
    if (element.startsWith('<!--')) continue;
    const tag = element.match(/^<\w+(?:"[^"]*"|'[^']*'|[^'">])*>/)![0];
    const attrs = attributes(tag);
    if (/^<meta\b/i.test(tag)) {
      if (attrs.get('property')?.toLowerCase() === 'article:published_time' ||
          attrs.get('name')?.toLowerCase() === 'date' ||
          attrs.get('itemprop')?.toLowerCase() === 'datepublished') addDate(attrs.get('content'));
    } else if (attrs.get('type')?.toLowerCase() === 'application/ld+json') {
      try {
        readJsonLd(JSON.parse(element.slice(tag.length, element.lastIndexOf('<'))));
      } catch {
        // Ignore malformed JSON-LD blocks.
      }
    }
  }
  return [...dates];
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
];

export function dateFound(happenedOn: string, html: string, pageText: string): boolean {
  const timestamp = Date.parse(happenedOn);
  if (publishedDates(html).some(date => Math.abs(Date.parse(date) - timestamp) <= 3 * 86_400_000)) return true;

  const [year, month, day] = happenedOn.split('-');
  const monthName = months[Number(month) - 1];
  const dayPart = day.startsWith('0') ? `0?${day[1]}` : day;
  const monthPart = month.startsWith('0') ? `0?${month[1]}` : month;
  const formats = [
    happenedOn, `${dayPart} ${monthName} ${year}`, `${monthName} ${dayPart}, ${year}`,
    `${dayPart}\\.${monthPart}\\.${year}`,
  ];
  return new RegExp(`\\b(?:${formats.join('|')})\\b`, 'i').test(normalizeForMatch(pageText));
}

const markers = String.raw`(?:US\$|[AC]\$|[€$£]|EUR|USD|GBP|DKK|SEK|NOK|CHF|kr\.?)`;
const number = String.raw`(\d+(?:[.,]\d+)*)`;
const multiplier = String.raw`(?: ?(billion|million|mio\.?|bn|mn|[kmb]))?`;
const prefixedAmount = new RegExp(String.raw`(?<![\w.,])(${markers}) ?${number}${multiplier}(?!\w|[.,]\d)`, 'gi');
const suffixedAmount = new RegExp(String.raw`(?<!\w|\d[.,])${number}${multiplier} ?(${markers})(?!\w)`, 'gi');
const magnitudes: Record<string, number> = {
  k: 1_000, m: 1_000_000, mn: 1_000_000, mio: 1_000_000, million: 1_000_000,
  b: 1_000_000_000, bn: 1_000_000_000, billion: 1_000_000_000,
};
const currencies: Record<string, string[]> = {
  '€': ['EUR'], '$': ['USD'], 'US$': ['USD'], 'A$': [], 'C$': [], '£': ['GBP'], KR: ['DKK', 'SEK', 'NOK'],
};

export function amountInQuote(amount: number, currency: string | null, quote: string): boolean {
  function matches(raw: string, suffix: string | undefined, marker: string): boolean {
    const code = marker.toUpperCase().replace(/\.$/, '');
    if (currency !== null && !(currencies[code] ?? [code]).includes(currency)) return false;
    const decimal = /[.,](\d{1,2})$/.exec(raw);
    const whole = raw.slice(0, decimal?.index ?? raw.length).replace(/[.,]/g, '');
    const value = Number(decimal ? `${whole}.${decimal[1]}` : whole);
    const total = value * (suffix ? magnitudes[suffix.toLowerCase().replace(/\.$/, '')] : 1);
    return Math.abs(total - amount) <= Math.abs(amount) * 0.005;
  }

  const text = quote.normalize('NFKC');
  for (const [, marker, raw, suffix] of text.matchAll(prefixedAmount)) {
    if (matches(raw, suffix, marker)) return true;
  }
  for (const [, raw, suffix, marker] of text.matchAll(suffixedAmount)) {
    if (matches(raw, suffix, marker)) return true;
  }
  return false;
}
