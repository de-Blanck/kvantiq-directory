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
