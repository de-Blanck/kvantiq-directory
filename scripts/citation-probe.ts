// scripts/citation-probe.ts
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { loadPrompts } from './lib/probe-prompts.ts';
import { scoreResponse } from './lib/probe-scoring.ts';
import { writeRun } from './lib/probe-storage.ts';
import { buildAdapters, loadKeysFromEnv } from './lib/adapters/index.ts';
import type { ModelAdapter } from './lib/probe-models.ts';
import { AdapterError } from './lib/probe-models.ts';
import type {
  ModelId, PerModelStats, ProbeResponse, RunFile, RunSummary,
} from './lib/probe-types.ts';

export interface RunProbeOptions {
  adapters: ModelAdapter[];
  promptsPath: string;
  outputBaseDir: string;
  isBaseline?: boolean;
  runDate?: Date;
}

export async function runProbe(opts: RunProbeOptions): Promise<RunFile> {
  const promptsFile = await loadPrompts(opts.promptsPath);
  const runDate = (opts.runDate ?? new Date()).toISOString();
  const responses: ProbeResponse[] = [];

  for (const prompt of promptsFile.prompts) {
    for (const adapter of opts.adapters) {
      const start = Date.now();
      try {
        const reply = await adapter.ask({ prompt: prompt.text });
        const score = scoreResponse(reply.text);
        responses.push({
          promptId: prompt.id,
          modelId: adapter.id,
          responseText: reply.text,
          score,
          latencyMs: reply.latencyMs,
          timestamp: new Date(start).toISOString(),
        });
      } catch (err) {
        responses.push({
          promptId: prompt.id,
          modelId: adapter.id,
          responseText: '',
          score: { label: 'absent', points: 0, reason: 'API error' },
          latencyMs: Date.now() - start,
          timestamp: new Date(start).toISOString(),
          error: err instanceof AdapterError ? String(err.cause) : String(err),
        });
      }
    }
  }

  const summary = summarize(responses, opts.adapters.map(a => a.id));
  const run: RunFile = {
    schemaVersion: '1',
    runDate,
    promptsVersion: promptsFile.version,
    isBaseline: opts.isBaseline ?? false,
    responses,
    summary,
  };

  await writeRun(run, opts.outputBaseDir);
  return run;
}

function summarize(responses: ProbeResponse[], modelIds: ModelId[]): RunSummary {
  const empty = (): PerModelStats => ({ cited: 0, mentioned: 0, absent: 0, errors: 0, citedPct: 0, mentionedPct: 0 });
  const byModel = Object.fromEntries(modelIds.map(id => [id, empty()])) as Record<ModelId, PerModelStats>;

  for (const r of responses) {
    const m = byModel[r.modelId];
    if (r.error) m.errors += 1;
    if (r.score.label === 'cited') m.cited += 1;
    else if (r.score.label === 'mentioned') m.mentioned += 1;
    else m.absent += 1;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  for (const stats of Object.values(byModel)) {
    const total = stats.cited + stats.mentioned + stats.absent;
    stats.citedPct = total ? round2((stats.cited / total) * 100) : 0;
    stats.mentionedPct = total ? round2((stats.mentioned / total) * 100) : 0;
  }

  const overall = empty();
  for (const s of Object.values(byModel)) {
    overall.cited += s.cited;
    overall.mentioned += s.mentioned;
    overall.absent += s.absent;
    overall.errors += s.errors;
  }
  const total = overall.cited + overall.mentioned + overall.absent;
  overall.citedPct = total ? round2((overall.cited / total) * 100) : 0;
  overall.mentionedPct = total ? round2((overall.mentioned / total) * 100) : 0;

  return { totalCalls: responses.length, byModel, overall };
}

// CLI entrypoint — only runs when executed directly, not when imported
const thisFile = fileURLToPath(import.meta.url);
const invokedAs = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedAs === thisFile) {
  const __dirname = dirname(thisFile);
  const isBaseline = process.argv.includes('--baseline');
  const keys = loadKeysFromEnv();
  const adapters = buildAdapters(keys);
  runProbe({
    adapters,
    promptsPath: resolve(__dirname, '../data/probes/prompts.json'),
    outputBaseDir: resolve(__dirname, '../data/probes'),
    isBaseline,
  })
    .then(run => {
      console.log(`✓ Probe complete — overall cited%: ${run.summary.overall.citedPct.toFixed(2)}`);
    })
    .catch(err => {
      console.error('✗ Probe failed:', err);
      process.exit(1);
    });
}
