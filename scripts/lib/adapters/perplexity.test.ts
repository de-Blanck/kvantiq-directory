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
