/**
 * Kvantiq Weekly Agent — runs via Claude Agent SDK.
 * Uses Anthropic API credits (Sonnet 4.6).
 */
import { query, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { sendEmail } from './tools/resend.js';
import { createClickUpTask } from './tools/clickup.js';

const ROOT = join(import.meta.dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const SCRIPTS_DIR = join(ROOT, 'scripts');

// --- Load system prompt ---
const SYSTEM_PROMPT = readFileSync(
  join(SCRIPTS_DIR, 'prompts', 'system-prompt.md'),
  'utf-8'
);

// --- Load sources ---
const SOURCES_JSON = readFileSync(join(DATA_DIR, 'sources.json'), 'utf-8');

// --- Check for pending files from previous failed runs ---
function loadPending(filename: string): string | null {
  const filePath = join(DATA_DIR, filename);
  if (existsSync(filePath)) {
    try {
      const content = readFileSync(filePath, 'utf-8').trim();
      if (content && content !== '[]' && content !== '{}') {
        console.log(`[weekly-agent] Found pending file: ${filename}`);
        return content;
      }
    } catch {
      // ignore read errors
    }
  }
  return null;
}

const pendingDiscoveryQueue = loadPending('discovery-queue.json');
const pendingClickUpTasks = loadPending('pending-clickup-tasks.json');
const pendingEmail = loadPending('pending-email.json');

// --- Build pending context block ---
function buildPendingContext(): string {
  const sections: string[] = [];

  if (pendingDiscoveryQueue) {
    sections.push(`## Pending Discovery Queue (from previous run)\n\n\`\`\`json\n${pendingDiscoveryQueue}\n\`\`\``);
  }
  if (pendingClickUpTasks) {
    sections.push(`## Pending ClickUp Tasks (failed to send last run)\n\n\`\`\`json\n${pendingClickUpTasks}\n\`\`\``);
  }
  if (pendingEmail) {
    sections.push(`## Pending Email (failed to send last run)\n\n\`\`\`json\n${pendingEmail}\n\`\`\``);
  }

  return sections.length > 0
    ? `\n\n---\n\n# PENDING ITEMS FROM PREVIOUS RUN\n\n${sections.join('\n\n')}`
    : '';
}

// --- Build the full prompt ---
const TODAY = new Date().toISOString().split('T')[0];

const AGENT_PROMPT = `# Kvantiq Weekly Agent Run — ${TODAY}

Today's date is **${TODAY}**.

## Sources

\`\`\`json
${SOURCES_JSON}
\`\`\`
${buildPendingContext()}

---

# Weekly Workflow

Execute the full weekly workflow as defined in your system prompt:

**Phase 0 — Startup:** Run SQLite integrity check. Process any pending items listed above. Check for an open weekly PR — if one exists, push to it instead of creating a new one.

**Phase 1 — Research:** Search every source above for new companies and events. Apply the entry quality gate. Cap at 10 new entries per PR. Queue overflow in \`data/discovery-queue.json\`.

**Phase 2 — Audit:** For every existing entry in \`src/content/companies/\`, do a tiered audit: HTTP HEAD check on all URLs (use Bash with \`curl -I --max-time 10\`), web search for 90-day activity signals, assign confidence scores, record in the audits table.

**Phase 3 — Act:** Write new JSON files to \`src/content/{collection}/\`. Update stale entries. Update the SQLite database. Create a git branch named \`weekly/${TODAY}\`. Commit all changes. Open a PR via \`gh pr create\`. Create ClickUp tasks for anything needing human judgment using the create_clickup_task MCP tool. Send alert emails for major events using the send_email MCP tool.

**Phase 4 — Report:** Add a \`market_snapshots\` row. Send the weekly digest email to hi@kvantiq.studio. Log sources_checked.

**Final step:** Run \`npx tsx scripts/generate-transparency-data.ts\` and commit the updated transparency data files.

Begin now. Work autonomously through all phases.`;

// --- Create MCP server with custom tools ---
const toolServer = createSdkMcpServer({
  name: 'kvantiq-tools',
  tools: [sendEmail, createClickUpTask],
});

// --- Run agent ---
console.log(`[weekly-agent] Starting Kvantiq weekly agent run — ${TODAY}`);
console.log(`[weekly-agent] Model: claude-sonnet-4-6`);
console.log(`[weekly-agent] Root: ${ROOT}`);

try {
  let turnCount = 0;
  for await (const message of query({
    prompt: AGENT_PROMPT,
    options: {
      cwd: ROOT,
      systemPrompt: SYSTEM_PROMPT,
      model: 'claude-sonnet-4-6',
      mcpServers: { 'kvantiq-tools': toolServer },
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: 200,
      maxBudgetUsd: 10.0,
    },
  })) {
    turnCount++;
    // Log progress for each message
    if (message && typeof message === 'object') {
      if ('result' in message) {
        console.log(`\n[weekly-agent] Agent completed after ${turnCount} turns.`);
        const result = message.result as Record<string, unknown> | undefined;
        if (result?.stop_reason) console.log(`[weekly-agent] Stop reason: ${result.stop_reason}`);
        if (result?.usage) console.log(`[weekly-agent] Usage: ${JSON.stringify(result.usage)}`);
      } else if ('type' in message && message.type === 'assistant') {
        const content = (message as Record<string, unknown>).content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === 'text' && typeof block.text === 'string') {
              // Log first 200 chars of assistant text
              const preview = block.text.slice(0, 200);
              console.log(`[weekly-agent] [turn ${turnCount}] ${preview}${block.text.length > 200 ? '...' : ''}`);
            } else if (block?.type === 'tool_use') {
              console.log(`[weekly-agent] [turn ${turnCount}] Tool: ${block.name}`);
            }
          }
        }
      }
    }
  }

  console.log(`[weekly-agent] Run complete.`);
} catch (error) {
  console.error(`[weekly-agent] Fatal error:`, error);
  process.exit(1);
}
