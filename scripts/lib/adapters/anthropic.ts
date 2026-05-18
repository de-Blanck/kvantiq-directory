// scripts/lib/adapters/anthropic.ts
//
// Calls the Claude Code CLI via subprocess and bills against the user's
// subscription programmatic credit pool. No api.anthropic.com calls.
// Auth: CLAUDE_CODE_OAUTH_TOKEN (generated locally with `claude setup-token`).
import { spawn, type ChildProcess, type SpawnOptions } from 'child_process';
import type { ModelAdapter, AskOptions, AskResult } from '../probe-models.ts';
import { AdapterError } from '../probe-models.ts';

export type Spawner = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcess;

interface AnthropicConfig {
  /** Long-lived OAuth token from `claude setup-token`. */
  oauthToken: string;
  /** Inject a custom spawner for testing. */
  spawner?: Spawner;
  /** Override the CLI model flag. */
  model?: string;
}

export class AnthropicAdapter implements ModelAdapter {
  readonly id = 'anthropic/claude-sonnet-4-6' as const;
  private readonly oauthToken: string;
  private readonly spawner: Spawner;
  private readonly model: string;

  constructor(config: AnthropicConfig) {
    this.oauthToken = config.oauthToken;
    this.spawner = config.spawner ?? (spawn as Spawner);
    this.model = config.model ?? 'claude-sonnet-4-6';
  }

  async ask(opts: AskOptions): Promise<AskResult> {
    const start = Date.now();
    return new Promise<AskResult>((resolve, reject) => {
      const child = this.spawner(
        'claude',
        ['-p', opts.prompt, '--model', this.model, '--output-format', 'text'],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            CLAUDE_CODE_OAUTH_TOKEN: this.oauthToken,
          },
        },
      );

      let stdout = '';
      let stderr = '';
      const timer = opts.timeoutMs
        ? setTimeout(() => {
            child.kill('SIGKILL');
            reject(new AdapterError(this.id, `timed out after ${opts.timeoutMs}ms`));
          }, opts.timeoutMs)
        : null;

      child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
      child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
      child.on('error', (err) => {
        if (timer) clearTimeout(timer);
        reject(new AdapterError(this.id, err));
      });
      child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        if (code !== 0) {
          reject(new AdapterError(this.id, `claude -p exit ${code}: ${stderr.trim() || stdout.trim()}`));
          return;
        }
        resolve({ text: stdout.trim(), latencyMs: Date.now() - start });
      });
    });
  }
}
