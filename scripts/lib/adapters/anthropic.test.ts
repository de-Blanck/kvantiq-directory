// scripts/lib/adapters/anthropic.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { AnthropicAdapter, type Spawner } from './anthropic.ts';

interface FakeChildOpts {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

function makeFakeChild({ exitCode = 0, stdout = '', stderr = '' }: FakeChildOpts) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: (signal: string) => void;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => {};
  // Emit asynchronously so the caller can wire listeners first.
  setImmediate(() => {
    if (stdout) child.stdout.emit('data', Buffer.from(stdout, 'utf8'));
    if (stderr) child.stderr.emit('data', Buffer.from(stderr, 'utf8'));
    child.emit('close', exitCode);
  });
  return child;
}

test('AnthropicAdapter invokes claude -p with subscription auth', async () => {
  let capturedCommand = '';
  let capturedArgs: readonly string[] = [];
  let capturedEnv: NodeJS.ProcessEnv | undefined;

  const fakeSpawner: Spawner = (command, args, options) => {
    capturedCommand = command;
    capturedArgs = args;
    capturedEnv = options.env as NodeJS.ProcessEnv;
    return makeFakeChild({ stdout: 'Hello world response.' }) as unknown as ReturnType<Spawner>;
  };

  const adapter = new AnthropicAdapter({ oauthToken: 'oauth-test', spawner: fakeSpawner });
  const result = await adapter.ask({ prompt: 'What is quantum?' });

  assert.equal(result.text, 'Hello world response.');
  assert.ok(result.latencyMs >= 0);
  assert.equal(capturedCommand, 'claude');
  assert.deepEqual(capturedArgs, ['-p', 'What is quantum?', '--model', 'claude-sonnet-4-6', '--output-format', 'text']);
  assert.equal(capturedEnv?.CLAUDE_CODE_OAUTH_TOKEN, 'oauth-test');
});

test('AnthropicAdapter throws AdapterError on non-zero exit', async () => {
  const fakeSpawner: Spawner = () =>
    makeFakeChild({ exitCode: 2, stderr: 'auth failed' }) as unknown as ReturnType<Spawner>;

  const adapter = new AnthropicAdapter({ oauthToken: 'k', spawner: fakeSpawner });
  await assert.rejects(() => adapter.ask({ prompt: 'x' }), /exit 2.*auth failed/);
});
