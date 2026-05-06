// scripts/lib/adapters/google.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GoogleAdapter } from './google.ts';

test('GoogleAdapter parses generateContent', async () => {
  const fakeClient = {
    getGenerativeModel: () => ({
      generateContent: async () => ({
        response: { text: () => 'Gemini response.' },
      }),
    }),
  };
  const adapter = new GoogleAdapter({ client: fakeClient as never });
  const result = await adapter.ask({ prompt: 'q' });
  assert.equal(result.text, 'Gemini response.');
});
