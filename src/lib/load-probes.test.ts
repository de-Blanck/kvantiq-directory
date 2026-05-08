// src/lib/load-probes.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadProbeHistory, loadLatestRun } from './load-probes.ts';

test('loadProbeHistory returns parsed array', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'loadprobe-'));
  try {
    await mkdir(join(dir, 'runs'), { recursive: true });
    const entry = {
      runDate: '2026-05-06T09:00:00.000Z', promptsVersion: '1', isBaseline: true,
      byModel: {
        'anthropic/claude-sonnet-4-6': { citedPct: 10, mentionedPct: 20 },
        'openai/gpt-4o': { citedPct: 5, mentionedPct: 15 },
        'perplexity/llama-3-sonar-large-online': { citedPct: 30, mentionedPct: 10 },
        'google/gemini-2.0-pro': { citedPct: 0, mentionedPct: 5 },
      },
      overall: { citedPct: 11.25, mentionedPct: 12.5 },
      notes: '',
    };
    await writeFile(join(dir, 'history.json'), JSON.stringify([entry]));
    const result = await loadProbeHistory(dir);
    assert.equal(result.length, 1);
    assert.equal(result[0].overall.citedPct, 11.25);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadLatestRun returns most recent run from history', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'loadprobe-'));
  try {
    await mkdir(join(dir, 'runs'), { recursive: true });
    const baseline = {
      runDate: '2026-05-06T09:00:00.000Z', promptsVersion: '1', isBaseline: true,
      byModel: {} as never, overall: { citedPct: 5, mentionedPct: 10 }, notes: '',
    };
    const recent = { ...baseline, runDate: '2026-05-13T09:00:00.000Z', isBaseline: false, overall: { citedPct: 8, mentionedPct: 12 } };
    await writeFile(join(dir, 'history.json'), JSON.stringify([baseline, recent]));
    const result = await loadLatestRun(dir);
    assert.equal(result?.runDate, '2026-05-13T09:00:00.000Z');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
