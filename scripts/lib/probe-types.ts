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
