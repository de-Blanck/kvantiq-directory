// scripts/lib/adapters/index.ts
import type { ModelAdapter } from '../probe-models.ts';
import { AnthropicAdapter } from './anthropic.ts';
import { OpenAIAdapter } from './openai.ts';
import { PerplexityAdapter } from './perplexity.ts';
import { GoogleAdapter } from './google.ts';

export interface ApiKeys {
  /** OAuth token from `claude setup-token` (subscription auth). */
  anthropicOauth: string;
  openai: string;
  perplexity: string;
  google: string;
}

export function loadKeysFromEnv(): ApiKeys {
  const required = ['CLAUDE_CODE_OAUTH_TOKEN', 'OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GOOGLE_API_KEY'] as const;
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  return {
    anthropicOauth: process.env.CLAUDE_CODE_OAUTH_TOKEN!,
    openai: process.env.OPENAI_API_KEY!,
    perplexity: process.env.PERPLEXITY_API_KEY!,
    google: process.env.GOOGLE_API_KEY!,
  };
}

export function buildAdapters(keys: ApiKeys): ModelAdapter[] {
  return [
    new AnthropicAdapter({ oauthToken: keys.anthropicOauth }),
    new OpenAIAdapter({ apiKey: keys.openai }),
    new PerplexityAdapter({ apiKey: keys.perplexity }),
    new GoogleAdapter({ apiKey: keys.google }),
  ];
}
