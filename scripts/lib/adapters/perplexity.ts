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
