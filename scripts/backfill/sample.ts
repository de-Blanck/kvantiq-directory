import { EVENT_TYPE_LABELS, type EventRecord } from '../../src/lib/events/schema';

function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleEvents(events: EventRecord[], n: number, seed: number): EventRecord[] {
  const pool = events.filter(event => event.origin === 'backfill');
  const random = mulberry32(seed);
  for (let index = pool.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [pool[index], pool[other]] = [pool[other], pool[index]];
  }
  return pool.slice(0, Math.max(0, n));
}

function escapeCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r\n?|\n/g, ' ');
}

export function sampleMarkdown(events: EventRecord[]): string {
  return [
    '| Entity | Type | Date | Summary | Quote | Source |',
    '| --- | --- | --- | --- | --- | --- |',
    ...events.map(event => {
      const cells = [
        event.entities.join(', '), EVENT_TYPE_LABELS[event.type], event.happenedOn,
        event.summary, event.quote, event.source.url,
      ];
      return `| ${cells.map(escapeCell).join(' | ')} |`;
    }),
  ].join('\n');
}
