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
