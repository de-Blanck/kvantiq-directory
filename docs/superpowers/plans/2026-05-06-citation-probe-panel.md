# Citation-Probe Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the citation-probe panel that measures LLM citation rate of `directory.kvantiq.studio` across 4 production-tier models using a fixed 30-prompt panel, with a day-1 baseline + weekly GitHub Actions automation + public transparency surface at `/transparency/citations`.

**Architecture:** TypeScript script run via `tsx`; multi-provider API abstraction with a uniform `ModelAdapter` interface; results persisted to JSON in the repo (`data/probes/runs/*.json` + append-only `data/probes/history.json` + human-readable `*.md` summaries); weekly GitHub Actions schedule writes new runs via auto-merged PRs (respecting `block-commit-to-main`); public Astro page renders history with a per-model trend chart.

**Tech Stack:** Node 22 + `tsx` (existing). `node --test` built-in runner with `--import tsx` for TypeScript test execution (no new test deps). `@anthropic-ai/claude-agent-sdk` (existing). `openai` SDK (new). `@google/generative-ai` SDK (new). Perplexity via plain `fetch`. Astro 6 + React 19 (existing) for the transparency page. `recharts` (new) for the trend chart.

**Spec:** `docs/superpowers/specs/2026-05-06-directory-organic-traffic-design.md`

**Companion plan (forthcoming):** Plan 2 — directory hardening pass (`robots.txt` fix, per-collection JSON-LD, OG images, monitoring instrumentation). Plan 2 must NOT execute until this plan ships the day-1 baseline.

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `data/probes/prompts.json` | v1 prompt panel (30 prompts × 5 dimensions) — version-locked |
| `data/probes/runs/.gitkeep` | Holds per-run output JSON + MD files |
| `data/probes/history.json` | Append-only run summary history |
| `scripts/lib/probe-types.ts` | TypeScript types for prompts, responses, scoring |
| `scripts/lib/probe-scoring.ts` | Scoring rubric implementation (cited / mentioned / absent) |
| `scripts/lib/probe-scoring.test.ts` | Scoring unit tests |
| `scripts/lib/probe-models.ts` | `ModelAdapter` interface + 4 provider adapters |
| `scripts/lib/probe-models.test.ts` | Adapter unit tests (mocked HTTP) |
| `scripts/lib/probe-prompts.ts` | Prompt loader + Zod validation of `prompts.json` |
| `scripts/lib/probe-prompts.test.ts` | Prompt loader tests |
| `scripts/lib/probe-storage.ts` | Write run JSON + MD + append history |
| `scripts/lib/probe-storage.test.ts` | Storage tests against tmp dir |
| `scripts/citation-probe.ts` | Top-level orchestrator script |
| `scripts/citation-probe.test.ts` | Orchestrator integration test (mocked adapters) |
| `.github/workflows/citation-probe.yml` | Weekly schedule + workflow_dispatch |
| `src/lib/load-probes.ts` | Astro-side reader for probe history |
| `src/lib/load-probes.test.ts` | Loader tests |
| `src/components/CitationTrendChart.tsx` | React chart of per-model `cited%` over time |
| `src/pages/transparency/citations.astro` | Public results page |

**Files to modify:**

| Path | Change |
|---|---|
| `package.json` | Add `test` script + new deps (`openai`, `@google/generative-ai`, `recharts`) |
| `src/components/Header.astro` | Add nav link "Citations" under Transparency |

`robots.txt`, `BaseLayout.astro`, per-collection schema files, OG generation, content audit instrumentation — **all deferred to Plan 2.**

---

## Task 1: Add test runner script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Inspect current `package.json` scripts**

```bash
git -C C:/Synapse/kvantiq-directory show feature/organic-traffic-design:package.json | head -25
```

Expected: existing scripts `dev`, `prebuild`, `build`, `postbuild`, `preview`, `astro`, `audit:content`. No `test` script yet.

- [ ] **Step 2: Add `test` script using `node --test`**

In `package.json`, inside the `"scripts"` object, add:

```json
"test": "node --test --import tsx 'scripts/**/*.test.ts' 'src/lib/**/*.test.ts'"
```

- [ ] **Step 3: Run `npm test` — should report no tests found**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
```

Expected: glob expands to nothing, exit 0. (Some shells will print "no test files found" — also acceptable.)

- [ ] **Step 4: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add package.json
git -C C:/Synapse/kvantiq-directory commit -m "build: add node:test runner via tsx"
```

---

## Task 2: Define probe types

**Files:**
- Create: `scripts/lib/probe-types.ts`

- [ ] **Step 1: Create `scripts/lib/probe-types.ts`**

```typescript
export type ModelId =
  | 'anthropic/claude-sonnet-4-6'
  | 'openai/gpt-4o'
  | 'perplexity/llama-3-sonar-large-online'
  | 'google/gemini-2.0-pro';

export type Dimension = 'geographic' | 'modality' | 'category' | 'entity' | 'discovery';

export interface Prompt {
  id: string;            // e.g. "geo-sweden"
  dimension: Dimension;
  text: string;
}

export interface PromptsFile {
  version: string;       // "1" — bump when set changes
  prompts: Prompt[];
}

export type ScoreLabel = 'cited' | 'mentioned' | 'absent';

export interface ScoreResult {
  label: ScoreLabel;
  points: 0 | 1 | 2;
  reason: string;        // human-readable explanation
}

export interface ProbeResponse {
  promptId: string;
  modelId: ModelId;
  responseText: string;
  score: ScoreResult;
  latencyMs: number;
  timestamp: string;     // ISO 8601
  error?: string;        // populated if the API call failed
}

export interface PerModelStats {
  cited: number;
  mentioned: number;
  absent: number;
  errors: number;
  citedPct: number;      // 0-100, rounded to 2 decimals
  mentionedPct: number;
}

export interface RunSummary {
  totalCalls: number;
  byModel: Record<ModelId, PerModelStats>;
  overall: PerModelStats;
}

export interface RunFile {
  schemaVersion: '1';
  runDate: string;       // ISO 8601
  promptsVersion: string;
  isBaseline: boolean;
  responses: ProbeResponse[];
  summary: RunSummary;
}

export interface HistoryEntry {
  runDate: string;
  promptsVersion: string;
  isBaseline: boolean;
  byModel: Record<ModelId, { citedPct: number; mentionedPct: number }>;
  overall: { citedPct: number; mentionedPct: number };
  notes: string;         // empty by default; humans annotate during weekly review
}

export type HistoryFile = HistoryEntry[];
```

- [ ] **Step 2: Verify it compiles**

```bash
npx --prefix C:/Synapse/kvantiq-directory tsc --noEmit scripts/lib/probe-types.ts
```

Expected: exits 0 with no output.

- [ ] **Step 3: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add scripts/lib/probe-types.ts
git -C C:/Synapse/kvantiq-directory commit -m "feat(probe): add probe type definitions"
```

---

## Task 3: Implement scoring module — failing tests

**Files:**
- Create: `scripts/lib/probe-scoring.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// scripts/lib/probe-scoring.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreResponse } from './probe-scoring.ts';

test('cited: response contains directory.kvantiq.studio root URL', () => {
  const result = scoreResponse('Visit https://directory.kvantiq.studio for details.');
  assert.equal(result.label, 'cited');
  assert.equal(result.points, 2);
});

test('cited: response contains directory.kvantiq.studio with path', () => {
  const result = scoreResponse('See https://directory.kvantiq.studio/companies/pasqal/');
  assert.equal(result.label, 'cited');
  assert.equal(result.points, 2);
});

test('cited: matches even without protocol', () => {
  const result = scoreResponse('directory.kvantiq.studio is a great resource.');
  assert.equal(result.label, 'cited');
});

test('mentioned: name without URL — Kvantiq Directory', () => {
  const result = scoreResponse('The Kvantiq Directory tracks European quantum companies.');
  assert.equal(result.label, 'mentioned');
  assert.equal(result.points, 1);
});

test('mentioned: name without URL — Kvantiq Studio', () => {
  const result = scoreResponse('Kvantiq Studio publishes industry data.');
  assert.equal(result.label, 'mentioned');
  assert.equal(result.points, 1);
});

test('mentioned: case-insensitive', () => {
  const result = scoreResponse('kvantiq studio is a small Danish company.');
  assert.equal(result.label, 'mentioned');
});

test('absent: no mention or URL', () => {
  const result = scoreResponse('European quantum companies include Pasqal, IQM, and Quandela.');
  assert.equal(result.label, 'absent');
  assert.equal(result.points, 0);
});

test('cited beats mentioned: response with both gets cited', () => {
  const result = scoreResponse('See Kvantiq Studio at https://directory.kvantiq.studio.');
  assert.equal(result.label, 'cited');
});

test('absent: empty string', () => {
  const result = scoreResponse('');
  assert.equal(result.label, 'absent');
});

test('false-positive guard: a different kvantiq URL does not count', () => {
  // We score on directory subdomain specifically; the marketing site is out of scope
  const result = scoreResponse('Visit https://kvantiq.studio for the platform.');
  assert.equal(result.label, 'mentioned'); // brand mention only, not the directory itself
});
```

- [ ] **Step 2: Run tests — expect all to fail**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
```

Expected: all 10 tests fail with `Cannot find module './probe-scoring.ts'`.

---

## Task 4: Implement scoring module — make tests pass

**Files:**
- Create: `scripts/lib/probe-scoring.ts`

- [ ] **Step 1: Implement `scoreResponse`**

```typescript
// scripts/lib/probe-scoring.ts
import type { ScoreResult } from './probe-types.ts';

const DIRECTORY_HOST = 'directory.kvantiq.studio';
const BRAND_PATTERNS = [/kvantiq\s+directory/i, /kvantiq\s+studio/i];

export function scoreResponse(responseText: string): ScoreResult {
  const text = responseText ?? '';

  if (text.toLowerCase().includes(DIRECTORY_HOST)) {
    return {
      label: 'cited',
      points: 2,
      reason: `Response contains ${DIRECTORY_HOST}`,
    };
  }

  if (BRAND_PATTERNS.some(p => p.test(text))) {
    return {
      label: 'mentioned',
      points: 1,
      reason: 'Response references Kvantiq by name without directory URL',
    };
  }

  return {
    label: 'absent',
    points: 0,
    reason: 'No mention or URL found',
  };
}
```

- [ ] **Step 2: Run tests — expect all to pass**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
```

Expected: 10 passing.

- [ ] **Step 3: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add scripts/lib/probe-scoring.ts scripts/lib/probe-scoring.test.ts
git -C C:/Synapse/kvantiq-directory commit -m "feat(probe): add scoring rubric (cited/mentioned/absent)"
```

---

## Task 5: Define `ModelAdapter` interface

**Files:**
- Create: `scripts/lib/probe-models.ts` (interface only — adapters added in next tasks)

- [ ] **Step 1: Write the interface and a registry stub**

```typescript
// scripts/lib/probe-models.ts
import type { ModelId } from './probe-types.ts';

export interface AskOptions {
  prompt: string;
  /** Hard timeout in ms; runner enforces. */
  timeoutMs?: number;
}

export interface AskResult {
  text: string;
  latencyMs: number;
}

export interface ModelAdapter {
  readonly id: ModelId;
  ask(opts: AskOptions): Promise<AskResult>;
}

export class AdapterError extends Error {
  constructor(
    public readonly modelId: ModelId,
    public readonly cause: unknown,
  ) {
    super(`Adapter ${modelId} failed: ${String(cause)}`);
  }
}

/** Registry populated by individual adapter modules. */
export const adapters: Map<ModelId, ModelAdapter> = new Map();

export function registerAdapter(adapter: ModelAdapter): void {
  adapters.set(adapter.id, adapter);
}
```

- [ ] **Step 2: Verify compile**

```bash
npx --prefix C:/Synapse/kvantiq-directory tsc --noEmit scripts/lib/probe-models.ts
```

- [ ] **Step 3: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add scripts/lib/probe-models.ts
git -C C:/Synapse/kvantiq-directory commit -m "feat(probe): add ModelAdapter interface + registry"
```

---

## Task 6: Anthropic adapter — failing test

**Files:**
- Create: `scripts/lib/adapters/anthropic.test.ts`

- [ ] **Step 1: Write the failing test using a mocked HTTP fetcher**

```typescript
// scripts/lib/adapters/anthropic.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnthropicAdapter } from './anthropic.ts';

test('AnthropicAdapter sends correct request shape', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  const fakeFetch = async (url: string, init: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return new Response(
      JSON.stringify({
        content: [{ type: 'text', text: 'Hello world response.' }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const adapter = new AnthropicAdapter({ apiKey: 'test-key', fetcher: fakeFetch as typeof fetch });
  const result = await adapter.ask({ prompt: 'What is quantum?' });

  assert.equal(result.text, 'Hello world response.');
  assert.ok(result.latencyMs >= 0);
  assert.equal(capturedUrl, 'https://api.anthropic.com/v1/messages');
  assert.equal((capturedInit?.headers as Record<string, string>)['x-api-key'], 'test-key');
  const body = JSON.parse(capturedInit?.body as string);
  assert.equal(body.model, 'claude-sonnet-4-6');
  assert.equal(body.messages[0].content, 'What is quantum?');
});

test('AnthropicAdapter throws AdapterError on non-200', async () => {
  const fakeFetch = async () =>
    new Response('rate limit', { status: 429, headers: { 'content-type': 'text/plain' } });

  const adapter = new AnthropicAdapter({ apiKey: 'k', fetcher: fakeFetch as typeof fetch });
  await assert.rejects(() => adapter.ask({ prompt: 'x' }), /429/);
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
```

Expected: 2 new failures (`Cannot find module './anthropic.ts'`).

---

## Task 7: Anthropic adapter — implementation

**Files:**
- Create: `scripts/lib/adapters/anthropic.ts`

- [ ] **Step 1: Implement adapter**

```typescript
// scripts/lib/adapters/anthropic.ts
import type { ModelAdapter, AskOptions, AskResult } from '../probe-models.ts';
import { AdapterError } from '../probe-models.ts';

interface AnthropicConfig {
  apiKey: string;
  /** Inject a custom fetcher for testing. */
  fetcher?: typeof fetch;
}

export class AnthropicAdapter implements ModelAdapter {
  readonly id = 'anthropic/claude-sonnet-4-6' as const;
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(config: AnthropicConfig) {
    this.apiKey = config.apiKey;
    this.fetcher = config.fetcher ?? fetch;
  }

  async ask(opts: AskOptions): Promise<AskResult> {
    const start = Date.now();
    try {
      const res = await this.fetcher('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{ role: 'user', content: opts.prompt }],
        }),
      });

      if (!res.ok) {
        throw new AdapterError(this.id, `HTTP ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
      const text = data.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      return { text, latencyMs: Date.now() - start };
    } catch (err) {
      if (err instanceof AdapterError) throw err;
      throw new AdapterError(this.id, err);
    }
  }
}
```

- [ ] **Step 2: Run tests — expect both Anthropic tests to pass**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
```

Expected: 12 passing total (10 scoring + 2 anthropic).

- [ ] **Step 3: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add scripts/lib/adapters/anthropic.ts scripts/lib/adapters/anthropic.test.ts
git -C C:/Synapse/kvantiq-directory commit -m "feat(probe): add Anthropic adapter"
```

---

## Task 8: OpenAI adapter

**Files:**
- Create: `scripts/lib/adapters/openai.test.ts`
- Create: `scripts/lib/adapters/openai.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the `openai` SDK as a dep**

```bash
npm --prefix C:/Synapse/kvantiq-directory install openai
```

- [ ] **Step 2: Write failing test**

```typescript
// scripts/lib/adapters/openai.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIAdapter } from './openai.ts';

test('OpenAIAdapter parses chat completion', async () => {
  const fakeClient = {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: 'OpenAI response.' } }],
        }),
      },
    },
  };
  const adapter = new OpenAIAdapter({ client: fakeClient as never });
  const result = await adapter.ask({ prompt: 'What?' });
  assert.equal(result.text, 'OpenAI response.');
  assert.ok(result.latencyMs >= 0);
});
```

- [ ] **Step 3: Implement adapter**

```typescript
// scripts/lib/adapters/openai.ts
import type { ModelAdapter, AskOptions, AskResult } from '../probe-models.ts';
import { AdapterError } from '../probe-models.ts';
import OpenAI from 'openai';

interface OpenAIConfig {
  apiKey?: string;
  /** Inject for testing. */
  client?: OpenAI;
}

export class OpenAIAdapter implements ModelAdapter {
  readonly id = 'openai/gpt-4o' as const;
  private readonly client: OpenAI;

  constructor(config: OpenAIConfig) {
    this.client = config.client ?? new OpenAI({ apiKey: config.apiKey });
  }

  async ask(opts: AskOptions): Promise<AskResult> {
    const start = Date.now();
    try {
      const res = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: opts.prompt }],
        max_tokens: 1024,
      });
      const text = res.choices[0]?.message?.content ?? '';
      return { text, latencyMs: Date.now() - start };
    } catch (err) {
      throw new AdapterError(this.id, err);
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
```

Expected: 13 passing (added 1 OpenAI test).

- [ ] **Step 5: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add scripts/lib/adapters/openai.ts scripts/lib/adapters/openai.test.ts package.json package-lock.json
git -C C:/Synapse/kvantiq-directory commit -m "feat(probe): add OpenAI adapter"
```

---

## Task 9: Perplexity adapter

**Files:**
- Create: `scripts/lib/adapters/perplexity.test.ts`
- Create: `scripts/lib/adapters/perplexity.ts`

- [ ] **Step 1: Write failing test**

```typescript
// scripts/lib/adapters/perplexity.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerplexityAdapter } from './perplexity.ts';

test('PerplexityAdapter parses response with citations', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: 'See https://directory.kvantiq.studio for details.' } }],
        citations: ['https://directory.kvantiq.studio/'],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  const adapter = new PerplexityAdapter({ apiKey: 'k', fetcher: fakeFetch as typeof fetch });
  const result = await adapter.ask({ prompt: 'q' });
  assert.match(result.text, /directory\.kvantiq\.studio/);
});
```

- [ ] **Step 2: Implement adapter**

```typescript
// scripts/lib/adapters/perplexity.ts
import type { ModelAdapter, AskOptions, AskResult } from '../probe-models.ts';
import { AdapterError } from '../probe-models.ts';

interface PerplexityConfig {
  apiKey: string;
  fetcher?: typeof fetch;
}

interface PerplexityResponse {
  choices: Array<{ message: { content: string } }>;
  citations?: string[];
}

export class PerplexityAdapter implements ModelAdapter {
  readonly id = 'perplexity/llama-3-sonar-large-online' as const;
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(config: PerplexityConfig) {
    this.apiKey = config.apiKey;
    this.fetcher = config.fetcher ?? fetch;
  }

  async ask(opts: AskOptions): Promise<AskResult> {
    const start = Date.now();
    try {
      const res = await this.fetcher('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3-sonar-large-online',
          messages: [{ role: 'user', content: opts.prompt }],
          max_tokens: 1024,
        }),
      });

      if (!res.ok) {
        throw new AdapterError(this.id, `HTTP ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as PerplexityResponse;
      const reply = data.choices[0]?.message?.content ?? '';
      // Concat citations into the response text so the scorer can find URLs
      const citations = (data.citations ?? []).join('\n');
      return {
        text: citations ? `${reply}\n\nCitations:\n${citations}` : reply,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      if (err instanceof AdapterError) throw err;
      throw new AdapterError(this.id, err);
    }
  }
}
```

- [ ] **Step 3: Test + commit**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
git -C C:/Synapse/kvantiq-directory add scripts/lib/adapters/perplexity.ts scripts/lib/adapters/perplexity.test.ts
git -C C:/Synapse/kvantiq-directory commit -m "feat(probe): add Perplexity adapter"
```

Expected: 14 passing.

---

## Task 10: Google Gemini adapter

**Files:**
- Create: `scripts/lib/adapters/google.test.ts`
- Create: `scripts/lib/adapters/google.ts`
- Modify: `package.json`

- [ ] **Step 1: Add SDK**

```bash
npm --prefix C:/Synapse/kvantiq-directory install @google/generative-ai
```

- [ ] **Step 2: Write failing test**

```typescript
// scripts/lib/adapters/google.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GoogleAdapter } from './google.ts';

test('GoogleAdapter parses generateContent', async () => {
  const fakeClient = {
    getGenerativeModel: () => ({
      generateContent: async () => ({
        response: { text: () => 'Gemini response.' },
      }),
    }),
  };
  const adapter = new GoogleAdapter({ client: fakeClient as never });
  const result = await adapter.ask({ prompt: 'q' });
  assert.equal(result.text, 'Gemini response.');
});
```

- [ ] **Step 3: Implement adapter**

```typescript
// scripts/lib/adapters/google.ts
import type { ModelAdapter, AskOptions, AskResult } from '../probe-models.ts';
import { AdapterError } from '../probe-models.ts';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface GoogleConfig {
  apiKey?: string;
  client?: GoogleGenerativeAI;
}

export class GoogleAdapter implements ModelAdapter {
  readonly id = 'google/gemini-2.0-pro' as const;
  private readonly client: GoogleGenerativeAI;

  constructor(config: GoogleConfig) {
    if (!config.client && !config.apiKey) {
      throw new Error('GoogleAdapter requires apiKey or client');
    }
    this.client = config.client ?? new GoogleGenerativeAI(config.apiKey!);
  }

  async ask(opts: AskOptions): Promise<AskResult> {
    const start = Date.now();
    try {
      const model = this.client.getGenerativeModel({ model: 'gemini-2.0-pro' });
      const res = await model.generateContent(opts.prompt);
      const text = res.response.text();
      return { text, latencyMs: Date.now() - start };
    } catch (err) {
      throw new AdapterError(this.id, err);
    }
  }
}
```

- [ ] **Step 4: Test + commit**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
git -C C:/Synapse/kvantiq-directory add scripts/lib/adapters/google.ts scripts/lib/adapters/google.test.ts package.json package-lock.json
git -C C:/Synapse/kvantiq-directory commit -m "feat(probe): add Google Gemini adapter"
```

Expected: 15 passing.

---

## Task 11: Wire adapters into registry + factory

**Files:**
- Create: `scripts/lib/adapters/index.ts`

- [ ] **Step 1: Write factory that builds all four adapters from env vars**

```typescript
// scripts/lib/adapters/index.ts
import type { ModelAdapter } from '../probe-models.ts';
import { AnthropicAdapter } from './anthropic.ts';
import { OpenAIAdapter } from './openai.ts';
import { PerplexityAdapter } from './perplexity.ts';
import { GoogleAdapter } from './google.ts';

export interface ApiKeys {
  anthropic: string;
  openai: string;
  perplexity: string;
  google: string;
}

export function loadKeysFromEnv(): ApiKeys {
  const required = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GOOGLE_API_KEY'] as const;
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  return {
    anthropic: process.env.ANTHROPIC_API_KEY!,
    openai: process.env.OPENAI_API_KEY!,
    perplexity: process.env.PERPLEXITY_API_KEY!,
    google: process.env.GOOGLE_API_KEY!,
  };
}

export function buildAdapters(keys: ApiKeys): ModelAdapter[] {
  return [
    new AnthropicAdapter({ apiKey: keys.anthropic }),
    new OpenAIAdapter({ apiKey: keys.openai }),
    new PerplexityAdapter({ apiKey: keys.perplexity }),
    new GoogleAdapter({ apiKey: keys.google }),
  ];
}
```

- [ ] **Step 2: Verify compile + commit**

```bash
npx --prefix C:/Synapse/kvantiq-directory tsc --noEmit scripts/lib/adapters/index.ts
git -C C:/Synapse/kvantiq-directory add scripts/lib/adapters/index.ts
git -C C:/Synapse/kvantiq-directory commit -m "feat(probe): add adapter factory + env loader"
```

---

## Task 12: Create the v1 prompt panel

**Files:**
- Create: `data/probes/prompts.json`

- [ ] **Step 1: Write the canonical 30-prompt JSON**

```json
{
  "version": "1",
  "prompts": [
    { "id": "geo-sweden",      "dimension": "geographic", "text": "What are the leading Sweden quantum computing companies?" },
    { "id": "geo-denmark",     "dimension": "geographic", "text": "What are the leading Denmark quantum computing companies?" },
    { "id": "geo-finland",     "dimension": "geographic", "text": "What are the leading Finland quantum computing companies?" },
    { "id": "geo-germany",     "dimension": "geographic", "text": "What are the leading Germany quantum computing companies?" },
    { "id": "geo-austria",     "dimension": "geographic", "text": "What are the leading Austria quantum computing companies?" },
    { "id": "geo-switzerland", "dimension": "geographic", "text": "What are the leading Switzerland quantum computing companies?" },

    { "id": "mod-trapped-ion",     "dimension": "modality", "text": "What companies build trapped-ion quantum technology in Europe?" },
    { "id": "mod-superconducting", "dimension": "modality", "text": "What companies build superconducting quantum technology in Europe?" },
    { "id": "mod-photonic",        "dimension": "modality", "text": "What companies build photonic quantum technology in Europe?" },
    { "id": "mod-neutral-atom",    "dimension": "modality", "text": "What companies build neutral-atom quantum technology in Europe?" },
    { "id": "mod-quantum-sensing", "dimension": "modality", "text": "What companies build quantum-sensing technology in Europe?" },
    { "id": "mod-cryogenic",       "dimension": "modality", "text": "What companies build cryogenic infrastructure for quantum computing in Europe?" },

    { "id": "cat-hardware",   "dimension": "category", "text": "What European quantum hardware should I know about?" },
    { "id": "cat-software",   "dimension": "category", "text": "What European quantum software should I know about?" },
    { "id": "cat-services",   "dimension": "category", "text": "What European quantum services should I know about?" },
    { "id": "cat-benchmarks", "dimension": "category", "text": "What European quantum benchmarks should I know about?" },
    { "id": "cat-use-cases",  "dimension": "category", "text": "What European quantum use cases should I know about?" },
    { "id": "cat-hackathons", "dimension": "category", "text": "What European quantum hackathons should I know about?" },

    { "id": "ent-pasqal",       "dimension": "entity", "text": "Tell me about Pasqal — who are they and what do they do?" },
    { "id": "ent-iqm",          "dimension": "entity", "text": "Tell me about IQM Quantum Computers — who are they and what do they do?" },
    { "id": "ent-bluefors",     "dimension": "entity", "text": "Tell me about Bluefors — who are they and what do they do?" },
    { "id": "ent-aqt",          "dimension": "entity", "text": "Tell me about Alpine Quantum Technologies (AQT) — who are they and what do they do?" },
    { "id": "ent-quandela",     "dimension": "entity", "text": "Tell me about Quandela — who are they and what do they do?" },
    { "id": "ent-id-quantique", "dimension": "entity", "text": "Tell me about ID Quantique — who are they and what do they do?" },

    { "id": "disc-student",     "dimension": "discovery", "text": "I'm a student interested in European quantum computing — where do I find structured information about the ecosystem?" },
    { "id": "disc-researcher",  "dimension": "discovery", "text": "I'm a researcher interested in European quantum computing — where do I find structured information about the ecosystem?" },
    { "id": "disc-journalist",  "dimension": "discovery", "text": "I'm a journalist covering European quantum computing — where do I find structured information about the ecosystem?" },
    { "id": "disc-investor",    "dimension": "discovery", "text": "I'm an investor evaluating European quantum computing — where do I find structured information about the ecosystem?" },
    { "id": "disc-policymaker", "dimension": "discovery", "text": "I'm a policymaker working on European quantum policy — where do I find structured information about the ecosystem?" },
    { "id": "disc-engineer",    "dimension": "discovery", "text": "I'm a software engineer interested in European quantum computing — where do I find structured information about the ecosystem?" }
  ]
}
```

- [ ] **Step 2: Validate count**

```bash
node --eval "const p=require('C:/Synapse/kvantiq-directory/data/probes/prompts.json');console.log('count:',p.prompts.length,'unique ids:',new Set(p.prompts.map(x=>x.id)).size)"
```

Expected: `count: 30 unique ids: 30`

- [ ] **Step 3: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add data/probes/prompts.json
git -C C:/Synapse/kvantiq-directory commit -m "feat(probe): add v1 prompt panel (30 prompts × 5 dimensions)"
```

---

## Task 13: Prompt loader with Zod validation

**Files:**
- Create: `scripts/lib/probe-prompts.test.ts`
- Create: `scripts/lib/probe-prompts.ts`

- [ ] **Step 1: Write failing test**

```typescript
// scripts/lib/probe-prompts.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPrompts } from './probe-prompts.ts';

test('loadPrompts returns 30 prompts with version 1', async () => {
  const file = await loadPrompts();
  assert.equal(file.version, '1');
  assert.equal(file.prompts.length, 30);
});

test('loadPrompts: every prompt has unique id', async () => {
  const file = await loadPrompts();
  const ids = new Set(file.prompts.map(p => p.id));
  assert.equal(ids.size, file.prompts.length);
});

test('loadPrompts: covers all 5 dimensions × 6 prompts each', async () => {
  const file = await loadPrompts();
  const counts = file.prompts.reduce<Record<string, number>>((acc, p) => {
    acc[p.dimension] = (acc[p.dimension] ?? 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(counts, { geographic: 6, modality: 6, category: 6, entity: 6, discovery: 6 });
});
```

- [ ] **Step 2: Implement loader**

```typescript
// scripts/lib/probe-prompts.ts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import type { PromptsFile } from './probe-types.ts';

const promptSchema = z.object({
  id: z.string().min(1),
  dimension: z.enum(['geographic', 'modality', 'category', 'entity', 'discovery']),
  text: z.string().min(10),
});

const promptsFileSchema = z.object({
  version: z.string().min(1),
  prompts: z.array(promptSchema).min(1),
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = resolve(__dirname, '../../data/probes/prompts.json');

export async function loadPrompts(path: string = DEFAULT_PATH): Promise<PromptsFile> {
  const raw = await readFile(path, 'utf-8');
  const parsed = promptsFileSchema.parse(JSON.parse(raw));
  const ids = new Set(parsed.prompts.map(p => p.id));
  if (ids.size !== parsed.prompts.length) {
    throw new Error('Duplicate prompt IDs detected');
  }
  return parsed;
}
```

- [ ] **Step 3: Test + commit**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
git -C C:/Synapse/kvantiq-directory add scripts/lib/probe-prompts.ts scripts/lib/probe-prompts.test.ts
git -C C:/Synapse/kvantiq-directory commit -m "feat(probe): add prompt loader + Zod validation"
```

Expected: 18 passing (15 + 3 new).

---

## Task 14: Storage module — write run JSON + MD + append history

**Files:**
- Create: `scripts/lib/probe-storage.test.ts`
- Create: `scripts/lib/probe-storage.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Implement storage**

```typescript
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
```

- [ ] **Step 3: Test + commit**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
git -C C:/Synapse/kvantiq-directory add scripts/lib/probe-storage.ts scripts/lib/probe-storage.test.ts
git -C C:/Synapse/kvantiq-directory commit -m "feat(probe): add run storage (JSON + MD + history append)"
```

Expected: 20 passing.

---

## Task 15: Probe orchestrator — failing test

**Files:**
- Create: `scripts/citation-probe.test.ts`

- [ ] **Step 1: Write integration test using mocked adapters**

```typescript
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
```

- [ ] **Step 2: Run — expect failure (`Cannot find module './citation-probe.ts'`)**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
```

---

## Task 16: Probe orchestrator — implementation

**Files:**
- Create: `scripts/citation-probe.ts`

- [ ] **Step 1: Implement the orchestrator**

```typescript
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
```

- [ ] **Step 2: Run tests — orchestrator test should pass**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
```

Expected: 21 passing.

- [ ] **Step 3: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add scripts/citation-probe.ts scripts/citation-probe.test.ts
git -C C:/Synapse/kvantiq-directory commit -m "feat(probe): add probe orchestrator + CLI entrypoint"
```

---

## Task 17: Run baseline locally

**Files:**
- Will create: `data/probes/runs/2026-05-06-baseline.json`, `data/probes/runs/2026-05-06-baseline.md`, `data/probes/history.json`

> **Cost note:** ~120 API calls, ~$2-5. **Do not skip this task — the spec requires the baseline to be the first thing committed.**

- [ ] **Step 1: Confirm all four API keys are available locally**

```bash
echo "ANTHROPIC: $([ -n "$ANTHROPIC_API_KEY" ] && echo yes || echo MISSING)"
echo "OPENAI: $([ -n "$OPENAI_API_KEY" ] && echo yes || echo MISSING)"
echo "PERPLEXITY: $([ -n "$PERPLEXITY_API_KEY" ] && echo yes || echo MISSING)"
echo "GOOGLE: $([ -n "$GOOGLE_API_KEY" ] && echo yes || echo MISSING)"
```

If any is `MISSING`, prompt Rune to provide it and pause this task.

- [ ] **Step 2: Run the probe with `--baseline`**

```bash
npx --prefix C:/Synapse/kvantiq-directory tsx scripts/citation-probe.ts --baseline
```

Expected: ~3-5 minute runtime, ~120 API calls, ends with `✓ Probe complete — overall cited%: <number>`. New files appear under `data/probes/`.

- [ ] **Step 3: Verify outputs**

```bash
ls C:/Synapse/kvantiq-directory/data/probes/runs/
cat C:/Synapse/kvantiq-directory/data/probes/runs/2026-05-06-baseline.md
```

Expected: `2026-05-06-baseline.json`, `2026-05-06-baseline.md` exist; markdown shows per-model table.

- [ ] **Step 4: Commit baseline**

```bash
git -C C:/Synapse/kvantiq-directory add data/probes/runs/2026-05-06-baseline.json data/probes/runs/2026-05-06-baseline.md data/probes/history.json
git -C C:/Synapse/kvantiq-directory commit -m "data(probe): record day-1 baseline (2026-05-06)"
```

This commit is the **measurement anchor** for everything in Plan 2.

---

## Task 18: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/citation-probe.yml`

- [ ] **Step 1: Write the workflow modeled on `weekly-agent.yml`**

```yaml
# .github/workflows/citation-probe.yml
name: Citation Probe

on:
  schedule:
    - cron: '0 9 * * 1'   # Mondays 09:00 UTC
  workflow_dispatch: {}

permissions:
  contents: write
  pull-requests: write

jobs:
  probe:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Run citation probe
        run: npx tsx scripts/citation-probe.ts
        timeout-minutes: 15
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          PERPLEXITY_API_KEY: ${{ secrets.PERPLEXITY_API_KEY }}
          GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}

      - name: Check for changes
        id: changes
        run: |
          git diff --quiet && git diff --cached --quiet && echo "changed=false" >> $GITHUB_OUTPUT || echo "changed=true" >> $GITHUB_OUTPUT

      - name: Commit and open PR
        if: steps.changes.outputs.changed == 'true'
        run: |
          git config user.name "Kvantiq Agent"
          git config user.email "agent@kvantiq.studio"
          BRANCH="probe/$(date +%Y-%m-%d)"
          git checkout -b "$BRANCH"
          git add data/probes/
          git commit -m "data(probe): weekly run $(date +%Y-%m-%d)"
          git push -u origin "$BRANCH"
          gh pr create \
            --title "Citation Probe — $(date +%Y-%m-%d)" \
            --body "Automated weekly probe results. Append-only — auto-mergeable. See \`data/probes/runs/$(date +%Y-%m-%d).md\` for the summary." \
            --base main \
            --head "$BRANCH" \
            --label "automated"
          gh pr merge --auto --squash "$BRANCH" || true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add .github/workflows/citation-probe.yml
git -C C:/Synapse/kvantiq-directory commit -m "ci(probe): add weekly citation-probe workflow"
```

- [ ] **Step 3: Push the branch + verify required secrets exist on GitHub**

```bash
git -C C:/Synapse/kvantiq-directory push -u origin feature/organic-traffic-design
gh secret list --repo de-Blanck/kvantiq-directory
```

Expected secrets present: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `GOOGLE_API_KEY`. If any missing, ask Rune to add via:

```bash
gh secret set OPENAI_API_KEY --repo de-Blanck/kvantiq-directory
```

- [ ] **Step 4: Manual workflow_dispatch trigger after PR merges to main**

(Deferred until Section 4 of this plan — the workflow only triggers properly from the default branch.)

---

## Task 19: Astro-side probe loader

**Files:**
- Create: `src/lib/load-probes.test.ts`
- Create: `src/lib/load-probes.ts`

- [ ] **Step 1: Failing test**

```typescript
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
```

- [ ] **Step 2: Implementation**

```typescript
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
```

- [ ] **Step 3: Test + commit**

```bash
npm --prefix C:/Synapse/kvantiq-directory test
git -C C:/Synapse/kvantiq-directory add src/lib/load-probes.ts src/lib/load-probes.test.ts
git -C C:/Synapse/kvantiq-directory commit -m "feat(probe): add Astro-side history loader"
```

Expected: 23 passing.

---

## Task 20: Trend chart React component

**Files:**
- Create: `src/components/CitationTrendChart.tsx`
- Modify: `package.json` (+ recharts)

- [ ] **Step 1: Add recharts**

```bash
npm --prefix C:/Synapse/kvantiq-directory install recharts
```

- [ ] **Step 2: Implement chart component**

```tsx
// src/components/CitationTrendChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { HistoryFile } from '../../scripts/lib/probe-types.ts';

interface Props {
  history: HistoryFile;
}

const MODEL_LABELS: Record<string, string> = {
  'anthropic/claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'openai/gpt-4o': 'GPT-4o',
  'perplexity/llama-3-sonar-large-online': 'Perplexity (web)',
  'google/gemini-2.0-pro': 'Gemini 2.0 Pro',
};

const MODEL_COLORS: Record<string, string> = {
  'anthropic/claude-sonnet-4-6': '#B45309',
  'openai/gpt-4o': '#1D4ED8',
  'perplexity/llama-3-sonar-large-online': '#16A34A',
  'google/gemini-2.0-pro': '#9333EA',
};

export default function CitationTrendChart({ history }: Props) {
  const data = history.map(entry => ({
    date: entry.runDate.slice(0, 10),
    ...Object.fromEntries(
      Object.entries(entry.byModel).map(([k, v]) => [k, v.citedPct]),
    ),
    overall: entry.overall.citedPct,
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#DDD8CF" />
          <XAxis dataKey="date" stroke="#57534E" />
          <YAxis stroke="#57534E" label={{ value: 'cited%', angle: -90, position: 'insideLeft', fill: '#57534E' }} />
          <Tooltip />
          <Legend />
          {Object.entries(MODEL_LABELS).map(([key, label]) => (
            <Line key={key} type="monotone" dataKey={key} name={label} stroke={MODEL_COLORS[key]} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add src/components/CitationTrendChart.tsx package.json package-lock.json
git -C C:/Synapse/kvantiq-directory commit -m "feat(probe): add citation trend chart component"
```

---

## Task 21: `/transparency/citations` Astro page

**Files:**
- Create: `src/pages/transparency/citations.astro`

- [ ] **Step 1: Implement the page**

```astro
---
// src/pages/transparency/citations.astro
import BaseLayout from '../../layouts/BaseLayout.astro';
import CitationTrendChart from '../../components/CitationTrendChart.tsx';
import { loadProbeHistory, loadLatestRun } from '../../lib/load-probes.ts';
import { resolve } from 'node:path';

const probesDir = resolve(import.meta.dirname ?? '.', '../../../data/probes');
const history = await loadProbeHistory(probesDir);
const latest = await loadLatestRun(probesDir);

const title = 'Citation Probe';
const description = 'Weekly measurement of how often LLMs (Claude, GPT-4o, Perplexity, Gemini) cite directory.kvantiq.studio.';

const MODEL_LABELS: Record<string, string> = {
  'anthropic/claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'openai/gpt-4o': 'GPT-4o',
  'perplexity/llama-3-sonar-large-online': 'Perplexity (web-grounded)',
  'google/gemini-2.0-pro': 'Gemini 2.0 Pro',
};
---

<BaseLayout title={title} description={description}>
  <article class="prose mx-auto max-w-3xl py-12">
    <header class="mb-8">
      <p class="font-mono text-xs uppercase tracking-[0.08em] text-text-secondary">Transparency</p>
      <h1 class="mt-2 text-3xl font-semibold">Citation Probe</h1>
      <p class="mt-3 text-text-secondary">
        Each Monday at 09:00 UTC, an automated probe asks 30 stable prompts to four production-tier LLMs (120 calls total) and records how many responses cite <code>directory.kvantiq.studio</code>.
        Results are committed to this repository as JSON, summarized here, and available for download.
      </p>
    </header>

    {!latest && (
      <p class="rounded-md border border-border bg-surface p-4 text-text-secondary">
        No probe runs recorded yet. The first run will appear here after Mon 2026-05-06.
      </p>
    )}

    {latest && (
      <section class="summary mb-12">
        <h2 class="text-xl font-semibold">Latest run — {latest.runDate.slice(0, 10)}</h2>
        <table class="mt-4 w-full table-auto border-collapse text-sm">
          <thead class="text-left text-text-secondary">
            <tr>
              <th class="pb-2">Model</th>
              <th class="pb-2 text-right">cited%</th>
              <th class="pb-2 text-right">mentioned%</th>
            </tr>
          </thead>
          <tbody class="font-mono">
            {Object.entries(latest.byModel).map(([key, stats]) => (
              <tr class="border-t border-border">
                <td class="py-2">{MODEL_LABELS[key] ?? key}</td>
                <td class="py-2 text-right">{stats.citedPct.toFixed(2)}</td>
                <td class="py-2 text-right">{stats.mentionedPct.toFixed(2)}</td>
              </tr>
            ))}
            <tr class="border-t-2 border-text-primary font-semibold">
              <td class="py-2">Overall</td>
              <td class="py-2 text-right">{latest.overall.citedPct.toFixed(2)}</td>
              <td class="py-2 text-right">{latest.overall.mentionedPct.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    )}

    {history.length > 1 && (
      <section class="mb-12">
        <h2 class="text-xl font-semibold">Trend</h2>
        <CitationTrendChart history={history} client:load />
      </section>
    )}

    <section class="faq">
      <h2 class="text-xl font-semibold">Methodology</h2>
      <p class="mt-2 text-text-secondary"><strong>Prompts:</strong> 30 prompts spanning 5 dimensions (geographic, modality, category, entity, discovery). The prompt set is version-locked at v1; any change requires a 4-week parallel run before retiring the old version.</p>
      <p class="mt-2 text-text-secondary"><strong>Models:</strong> Claude Sonnet 4.6 (Anthropic), GPT-4o (OpenAI), Perplexity Sonar Large Online (web-grounded), Gemini 2.0 Pro (Google). 30 prompts × 4 models = 120 calls per run.</p>
      <p class="mt-2 text-text-secondary"><strong>Scoring:</strong> 2 points if the response contains the URL <code>directory.kvantiq.studio</code> (any path); 1 point if it mentions "Kvantiq Studio" or "Kvantiq Directory" without a URL; 0 otherwise.</p>
      <p class="mt-2 text-text-secondary"><strong>Source code:</strong> <a class="underline" href="https://github.com/de-Blanck/kvantiq-directory/blob/main/scripts/citation-probe.ts">scripts/citation-probe.ts</a> · <a class="underline" href="https://github.com/de-Blanck/kvantiq-directory/blob/main/.github/workflows/citation-probe.yml">.github/workflows/citation-probe.yml</a></p>
      <p class="mt-2 text-text-secondary"><strong>Raw history:</strong> <a class="underline" href="https://github.com/de-Blanck/kvantiq-directory/blob/main/data/probes/history.json">data/probes/history.json</a></p>
    </section>
  </article>
</BaseLayout>
```

- [ ] **Step 2: Build to verify Astro renders the page**

```bash
npm --prefix C:/Synapse/kvantiq-directory run build
```

Expected: build succeeds, includes `dist/transparency/citations/index.html`.

- [ ] **Step 3: Spot-check the static HTML**

```bash
grep -c "Citation Probe" C:/Synapse/kvantiq-directory/dist/transparency/citations/index.html
```

Expected: ≥1.

- [ ] **Step 4: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add src/pages/transparency/citations.astro
git -C C:/Synapse/kvantiq-directory commit -m "feat(probe): add /transparency/citations public page"
```

---

## Task 22: Add nav link

**Files:**
- Modify: `src/components/Header.astro`

- [ ] **Step 1: Inspect the existing Header to find the Transparency nav structure**

```bash
grep -n "transparency" C:/Synapse/kvantiq-directory/src/components/Header.astro
```

- [ ] **Step 2: Add a "Citations" link adjacent to the existing Transparency entries**

Edit `src/components/Header.astro` — locate the Transparency nav block and add:

```astro
<a href="/transparency/citations/" class="nav-link">Citations</a>
```

(Match the existing nav-link styling pattern in the file.)

- [ ] **Step 3: Build + spot-check**

```bash
npm --prefix C:/Synapse/kvantiq-directory run build
grep -c "transparency/citations" C:/Synapse/kvantiq-directory/dist/index.html
```

Expected: ≥1.

- [ ] **Step 4: Commit**

```bash
git -C C:/Synapse/kvantiq-directory add src/components/Header.astro
git -C C:/Synapse/kvantiq-directory commit -m "feat(nav): add Citations link under Transparency"
```

---

## Task 23: Open the PR

- [ ] **Step 1: Push branch + open PR**

```bash
git -C C:/Synapse/kvantiq-directory push -u origin feature/organic-traffic-design

gh pr create --repo de-Blanck/kvantiq-directory \
  --title "feat: citation-probe panel + day-1 baseline" \
  --base main \
  --head feature/organic-traffic-design \
  --body "$(cat <<'EOF'
## Summary

Ships the citation-probe panel that measures LLM citation rate of `directory.kvantiq.studio` weekly across 4 production-tier models, plus the day-1 baseline run, plus the public `/transparency/citations` page.

This is **Plan 1 of 2** for the directory organic-traffic project. Plan 2 (hardening pass — robots.txt, JSON-LD, OG images, monitoring instrumentation) follows once this lands.

## What ships

- **Probe runner** — `scripts/citation-probe.ts` orchestrates 30 prompts × 4 models (Anthropic, OpenAI, Perplexity, Google), scores responses (cited/mentioned/absent), persists JSON + Markdown + history.
- **Day-1 baseline** — `data/probes/runs/2026-05-06-baseline.json`. **Measurement anchor for everything in Plan 2.**
- **Weekly automation** — `.github/workflows/citation-probe.yml` runs Mondays 09:00 UTC, opens append-only PRs that auto-merge.
- **Public page** — `/transparency/citations` shows the latest run + 12-week trend chart + methodology + raw-data link.
- **Test coverage** — node:test via tsx, ~25 tests covering scoring, adapters, prompt loading, storage, orchestration, page loader.

## Spec

`docs/superpowers/specs/2026-05-06-directory-organic-traffic-design.md`

## Plan

`docs/superpowers/plans/2026-05-06-citation-probe-panel.md`

## Test plan

- [ ] `npm test` passes locally
- [ ] `npm run build` succeeds
- [ ] Day-1 baseline JSON exists and contains 120 responses
- [ ] `/transparency/citations` renders the latest run
- [ ] Workflow `workflow_dispatch` triggers successfully on `main` after merge

EOF
)"
```

- [ ] **Step 2: Wait for Rune's review + merge**

This plan terminates here. **Plan 2 (hardening pass) starts only after this PR merges to main and the day-1 baseline is on `main`.**

---

## Self-Review (executed during plan authoring)

**Spec coverage:**

| Spec section | Plan task |
|---|---|
| North-star: per-model `cited%` weekly | Tasks 4, 16 (scoring + summarize) |
| Probe set: 30 prompts × 5 dimensions | Task 12 (prompts.json) + Task 13 (loader validates count) |
| Models: Anthropic, OpenAI, Perplexity, Google | Tasks 6-10 (one adapter each) |
| Scoring rubric (cited/mentioned/absent) | Tasks 3-4 |
| Runner: read prompts, score, persist | Tasks 14-16 |
| Schedule: Mondays 09:00 UTC + manual | Task 18 |
| Day-1 baseline before any other change | Task 17 + plan ordering note |
| Public surface: `/transparency/citations` | Tasks 21-22 |
| Append-only PRs respect `block-commit-to-main` | Task 18 (workflow uses branch + gh pr create) |
| Methodology disclosure on transparency page | Task 21 (FAQ section in Astro page) |

No spec section is unimplemented.

**Placeholder scan:** None found. Every code step contains complete code; every command step has the literal command and expected output. The only intentional fill-in is `gh secret set OPENAI_API_KEY` (Task 18 step 3) — that's an action Rune may need to take, not a placeholder in the plan.

**Type consistency:** `ModelId` is the same union string in `probe-types.ts`, used identically in adapters, summarizer, history entries, and the chart component. `ScoreLabel` / `ScoreResult` consistent across scoring + orchestrator + storage. `RunFile.summary.byModel` is `Record<ModelId, PerModelStats>` in types and used the same way in storage + orchestrator + page.

**Scope check:** Plan covers one coherent subsystem (the measurement loop) — runner + baseline + workflow + public surface. Hardening interventions are explicitly Plan 2. Single PR boundary at Task 23.

---

## Companion: Plan 2 — Directory Hardening Pass (forthcoming)

After this PR merges, the next plan covers:

- `robots.txt` sitemap path fix
- Per-collection JSON-LD: `Dataset`, `Article`, `Event`, `ItemList`
- `SpeakableSpecification` selector fix
- Per-entry OG image generation (satori build-time endpoint)
- Internal-link audit
- `BaseLayout` monitoring instrumentation (Plausible + GSC + Bing verification)
- Source-bar backfill workstream (existing weekly agent)

Plan 2 will be written immediately after Rune approves merging the PR from this plan.
