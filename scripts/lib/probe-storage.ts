// scripts/lib/probe-storage.ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RunFile, HistoryFile, HistoryEntry, ModelId, PerModelStats } from './probe-types.ts';

export async function writeRun(run: RunFile, baseDir: string): Promise<void> {
  const dateOnly = run.runDate.slice(0, 10);
  const fileSlug = run.isBaseline ? `${dateOnly}-baseline` : dateOnly;
  const runsDir = join(baseDir, 'runs');
  await mkdir(runsDir, { recursive: true });

  const jsonPath = join(runsDir, `${fileSlug}.json`);
  await writeFile(jsonPath, JSON.stringify(run, null, 2) + '\n', 'utf-8');

  const mdPath = join(runsDir, `${fileSlug}.md`);
  await writeFile(mdPath, renderMarkdownSummary(run), 'utf-8');

  const historyPath = join(baseDir, 'history.json');
  const history: HistoryFile = existsSync(historyPath)
    ? JSON.parse(await readFile(historyPath, 'utf-8'))
    : [];
  history.push(toHistoryEntry(run));
  await writeFile(historyPath, JSON.stringify(history, null, 2) + '\n', 'utf-8');
}

function toHistoryEntry(run: RunFile): HistoryEntry {
  const byModel = Object.fromEntries(
    (Object.entries(run.summary.byModel) as Array<[ModelId, PerModelStats]>).map(
      ([k, v]) => [k, { citedPct: v.citedPct, mentionedPct: v.mentionedPct }],
    ),
  ) as HistoryEntry['byModel'];
  return {
    runDate: run.runDate,
    promptsVersion: run.promptsVersion,
    isBaseline: run.isBaseline,
    byModel,
    overall: { citedPct: run.summary.overall.citedPct, mentionedPct: run.summary.overall.mentionedPct },
    notes: '',
  };
}

function renderMarkdownSummary(run: RunFile): string {
  const lines: string[] = [];
  lines.push(`# ${run.isBaseline ? 'Baseline run' : 'Probe run'} — ${run.runDate.slice(0, 10)}`);
  lines.push('');
  lines.push(`Prompts version: \`${run.promptsVersion}\``);
  lines.push(`Total calls: ${run.summary.totalCalls}`);
  lines.push('');
  lines.push('## Per-model results');
  lines.push('');
  lines.push('| Model | cited% | mentioned% | absent | errors |');
  lines.push('|---|---|---|---|---|');
  for (const [modelId, stats] of Object.entries(run.summary.byModel) as Array<[string, PerModelStats]>) {
    lines.push(`| \`${modelId}\` | ${stats.citedPct.toFixed(2)} | ${stats.mentionedPct.toFixed(2)} | ${stats.absent} | ${stats.errors} |`);
  }
  lines.push('');
  lines.push('## Overall');
  lines.push(`- cited%: **${run.summary.overall.citedPct.toFixed(2)}**`);
  lines.push(`- mentioned%: ${run.summary.overall.mentionedPct.toFixed(2)}`);
  lines.push('');
  return lines.join('\n');
}
