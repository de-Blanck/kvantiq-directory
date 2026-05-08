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
