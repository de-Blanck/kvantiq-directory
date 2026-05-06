// src/lib/load-probes.ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HistoryEntry, HistoryFile } from '../../scripts/lib/probe-types.ts';

export async function loadProbeHistory(baseDir: string): Promise<HistoryFile> {
  try {
    const raw = await readFile(join(baseDir, 'history.json'), 'utf-8');
    return JSON.parse(raw) as HistoryFile;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

export async function loadLatestRun(baseDir: string): Promise<HistoryEntry | null> {
  const history = await loadProbeHistory(baseDir);
  if (history.length === 0) return null;
  return history.reduce<HistoryEntry>((latest, entry) =>
    entry.runDate > latest.runDate ? entry : latest, history[0]);
}
