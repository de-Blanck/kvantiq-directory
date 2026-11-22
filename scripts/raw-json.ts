type ValueSpan = { start: number; end: number; firstItem?: number; lastItemEnd?: number };
type Property = ValueSpan & { key: string; keyStart: number };
type Duplicate = { path: string; key: string; count: number };

function scan(raw: string) {
  JSON.parse(raw);
  let offset = 0;
  const properties: Property[] = [];
  const duplicates: Duplicate[] = [];

  function skipWhitespace() {
    while (/[ \t\r\n]/.test(raw[offset] ?? '')) offset++;
  }

  function readString(): string {
    const start = offset++;
    while (raw[offset] !== '"') {
      if (raw[offset] === '\\') offset++;
      offset++;
    }
    return JSON.parse(raw.slice(start, ++offset));
  }

  function readValue(path: string, topLevel = false): ValueSpan {
    skipWhitespace();
    const start = offset;
    let firstItem: number | undefined;
    let lastItemEnd: number | undefined;

    if (raw[offset] === '{') {
      const counts = new Map<string, number>();
      offset++;
      skipWhitespace();
      while (raw[offset] !== '}') {
        const keyStart = offset;
        const key = readString();
        counts.set(key, (counts.get(key) ?? 0) + 1);
        skipWhitespace();
        offset++; // Colon
        const value = readValue(`${path}.${key}`);
        if (topLevel) properties.push({ key, keyStart, ...value });
        skipWhitespace();
        if (raw[offset] === ',') offset++;
        skipWhitespace();
      }
      offset++;
      for (const [key, count] of counts) {
        if (count > 1) duplicates.push({ path, key, count });
      }
    } else if (raw[offset] === '[') {
      offset++;
      skipWhitespace();
      for (let index = 0; raw[offset] !== ']'; index++) {
        const item = readValue(`${path}[${index}]`);
        firstItem ??= item.start;
        lastItemEnd = item.end;
        skipWhitespace();
        if (raw[offset] === ',') offset++;
        skipWhitespace();
      }
      offset++;
    } else if (raw[offset] === '"') {
      readString();
    } else {
      while (offset < raw.length && !/[\s,}\]]/.test(raw[offset])) offset++;
    }

    return { start, end: offset, firstItem, lastItemEnd };
  }

  readValue('$', true);
  return { properties, duplicates };
}

export function topLevelArrays(raw: string, key: string): unknown[][] {
  return scan(raw).properties
    .filter(property => property.key === key && raw[property.start] === '[')
    .map(({ start, end }) => JSON.parse(raw.slice(start, end)));
}

export function duplicateKeys(raw: string): Duplicate[] {
  return scan(raw).duplicates;
}

function indentationAt(raw: string, offset: number): string | undefined {
  const prefix = raw.slice(raw.lastIndexOf('\n', offset - 1) + 1, offset);
  return /^[ \t]*$/.test(prefix) ? prefix : undefined;
}

export function appendToTopLevelArray(raw: string, key: string, items: unknown[]): string {
  const matches = scan(raw).properties.filter(property => property.key === key);
  if (matches.length !== 1 || raw[matches[0].start] !== '[') {
    throw new Error(`Expected exactly one top-level array for ${JSON.stringify(key)}`);
  }
  if (items.length === 0) return raw;

  const { start, end, keyStart, firstItem, lastItemEnd } = matches[0];
  const newline = raw.match(/\r?\n/)?.[0] ?? '\n';
  const keyIndent = indentationAt(raw, keyStart) ?? '';
  const itemIndent = (firstItem === undefined ? undefined : indentationAt(raw, firstItem))
    ?? keyIndent + '  ';
  const formatted = items.map(item => JSON.stringify(item, null, 2)
    .split('\n').map(line => itemIndent + line).join(newline)).join(',' + newline);

  const insertion = lastItemEnd ?? start + 1;
  const closingIndent = raw.slice(insertion, end - 1).includes('\n') ? '' : newline + keyIndent;
  const comma = lastItemEnd === undefined ? '' : ',';
  return raw.slice(0, insertion) + comma + newline + formatted + closingIndent + raw.slice(insertion);
}
