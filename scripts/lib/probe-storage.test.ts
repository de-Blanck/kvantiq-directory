// scripts/lib/probe-storage.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeRun } from './probe-storage.ts';
import type { RunFile } from './probe-types.ts';

const fakeRun: RunFile = {
  schemaVersion: '1',
  runDate: '2026-05-06T09:00:00.000Z',
  promptsVersion: '1',
  isBaseline: true,
  responses: [],
  summary: {
    totalCalls: 0,
    byModel: {} as never,
    overall: { cited: 0, mentioned: 0, absent: 0, errors: 0, citedPct: 0, mentionedPct: 0 },
  },
};

test('writeRun creates JSON, MD, and appends history', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'probe-test-'));
  try {
    await writeRun(fakeRun, dir);
    const json = JSON.parse(await readFile(join(dir, 'runs/2026-05-06-baseline.json'), 'utf-8'));
    assert.equal(json.runDate, fakeRun.runDate);
    const md = await readFile(join(dir, 'runs/2026-05-06-baseline.md'), 'utf-8');
    assert.match(md, /Baseline run/);
    const history = JSON.parse(await readFile(join(dir, 'history.json'), 'utf-8'));
    assert.equal(history.length, 1);
    assert.equal(history[0].runDate, fakeRun.runDate);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeRun appends to existing history', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'probe-test-'));
  try {
    await writeRun(fakeRun, dir);
    const second = { ...fakeRun, runDate: '2026-05-13T09:00:00.000Z', isBaseline: false };
    await writeRun(second, dir);
    const history = JSON.parse(await readFile(join(dir, 'history.json'), 'utf-8'));
    assert.equal(history.length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
