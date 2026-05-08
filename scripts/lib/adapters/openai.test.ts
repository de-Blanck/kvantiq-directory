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
