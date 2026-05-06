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
