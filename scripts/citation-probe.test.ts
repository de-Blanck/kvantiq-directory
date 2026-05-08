// scripts/citation-probe.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runProbe } from './citation-probe.ts';
import type { ModelAdapter, AskResult } from './lib/probe-models.ts';
import type { ModelId } from './lib/probe-types.ts';

class StubAdapter implements ModelAdapter {
  constructor(public readonly id: ModelId, private readonly canned: string) {}
  async ask(): Promise<AskResult> {
    return { text: this.canned, latencyMs: 1 };
  }
}

test('runProbe writes run + history with correct scoring', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'probe-orch-'));
  try {
    const adapters: ModelAdapter[] = [
      new StubAdapter('anthropic/claude-sonnet-4-6', 'See https://directory.kvantiq.studio for info.'),
      new StubAdapter('openai/gpt-4o', 'Kvantiq Studio is interesting.'),
      new StubAdapter('perplexity/llama-3-sonar-large-online', 'Other companies exist.'),
      new StubAdapter('google/gemini-2.0-pro', ''),
    ];

    await runProbe({
      adapters,
      promptsPath: 'data/probes/prompts.json',
      outputBaseDir: dir,
      isBaseline: true,
      runDate: new Date('2026-05-06T09:00:00.000Z'),
    });

    const json = JSON.parse(await readFile(join(dir, 'runs/2026-05-06-baseline.json'), 'utf-8'));
    assert.equal(json.responses.length, 120); // 30 × 4
    assert.equal(json.summary.totalCalls, 120);
    // Anthropic cited every prompt → 100%
    assert.equal(json.summary.byModel['anthropic/claude-sonnet-4-6'].citedPct, 100);
    // OpenAI mentioned every prompt → 0% cited, 100% mentioned
    assert.equal(json.summary.byModel['openai/gpt-4o'].citedPct, 0);
    assert.equal(json.summary.byModel['openai/gpt-4o'].mentionedPct, 100);
    // Perplexity absent everywhere
    assert.equal(json.summary.byModel['perplexity/llama-3-sonar-large-online'].citedPct, 0);
    assert.equal(json.summary.byModel['perplexity/llama-3-sonar-large-online'].mentionedPct, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
