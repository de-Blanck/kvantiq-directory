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
