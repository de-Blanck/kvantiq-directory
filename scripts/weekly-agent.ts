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
    sections.push(`## Pending Discovery Queue (from previous run)

The previous agent run did not process all discovered companies. Continue where it left off — do NOT re-research sources that are already queued. Process the queue first before adding new entries.

\`\`\`json
${pendingDiscoveryQueue}
\`\`\``);
  }

  if (pendingClickUpTasks) {
    sections.push(`## Pending ClickUp Tasks (failed to send last run)

These ClickUp tasks were not successfully sent last run. Retry them before creating new ones.

\`\`\`json
${pendingClickUpTasks}
\`\`\``);
  }

  if (pendingEmail) {
    sections.push(`## Pending Email (failed to send last run)

This email was not successfully sent last run. Retry sending it before drafting the new weekly digest.

\`\`\`json
${pendingEmail}
\`\`\``);
  }

  return sections.length > 0
    ? `\n\n---\n\n# PENDING ITEMS FROM PREVIOUS RUN\n\n${sections.join('\n\n')}`
    : '';
}

// --- Build agent prompt ---
const TODAY = new Date().toISOString().split('T')[0];

const AGENT_PROMPT = `# Kvantiq Weekly Agent Run — ${TODAY}

Today's date is **${TODAY}**.

## Sources

The following sources are configured for research. Load them, search each for new EU/UK/Iceland quantum companies and industry events, and follow the workflow defined in your system prompt.

\`\`\`json
${SOURCES_JSON}
\`\`\`
${buildPendingContext()}

---

# Weekly Workflow

Execute the full weekly workflow as defined in your system prompt:

**Phase 0 — Startup:** Run SQLite integrity check. Process any pending items listed above before doing anything else. Check for an open weekly PR — if one exists, push to it instead of creating a new one.

**Phase 1 — Research:** Search every source above for new companies and events. Apply the entry quality gate. Cap at 10 new entries per PR. Queue overflow in \`data/discovery-queue.json\`. Track global companies in the intelligence DB only (no PR entries).

**Phase 2 — Audit:** For every existing entry in \`src/content/companies/\`, do a tiered audit: HTTP HEAD check on all URLs (use Bash with \`curl -I --max-time 10\`), web search for 90-day activity signals, assign confidence scores (HIGH/MEDIUM/LOW/DEAD), record in the audits table.

**Phase 3 — Act:** Write new JSON files to \`src/content/{collection}/\`. Update stale entries. Update the SQLite database. Create a git branch named \`weekly/${TODAY}\`. Commit all changes. Open a PR via \`gh pr create\`. Create ClickUp tasks for anything needing human judgment.

**Phase 4 — Report:** Add a \`market_snapshots\` row. Send immediate alert emails for any major events (funding ≥ €10M, acquisitions, closures, breakthroughs). Send the weekly digest email. Log sources_checked.

**Final step — Transparency data:** After completing all phases, run the following command to regenerate the transparency data files used by the public dashboard:

\`\`\`bash
npx tsx scripts/generate-transparency-data.ts
\`\`\`

Commit the updated transparency data files as part of the weekly PR.

---

Begin now. Work autonomously through all phases. Do not ask for confirmation unless you hit a true blocker.`;

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
  const response = query(AGENT_PROMPT, {
    cwd: ROOT,
    systemPrompt: SYSTEM_PROMPT,
    model: 'claude-sonnet-4-6',
    mcpServers: { 'kvantiq-tools': toolServer },
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    maxTurns: 200,
    maxBudgetUsd: 10.0,
  });

  for await (const message of response) {
    if ('result' in message) {
      console.log(`[weekly-agent] Agent completed.`);
      console.log(`[weekly-agent] Stop reason: ${message.result?.stop_reason ?? 'unknown'}`);
      const usage = message.result?.usage;
      if (usage) {
        console.log(
          `[weekly-agent] Token usage — input: ${usage.input_tokens}, output: ${usage.output_tokens}`
        );
      }
    } else if (message.type === 'message') {
      const role = message.role ?? 'assistant';
      if (role === 'assistant') {
        // Log text content from assistant turns
        for (const block of message.content ?? []) {
          if (block.type === 'text') {
            const preview = block.text.slice(0, 200).replace(/\n/g, ' ');
            console.log(`[agent] ${preview}${block.text.length > 200 ? '…' : ''}`);
          } else if (block.type === 'tool_use') {
            console.log(`[tool_use] ${block.name}(${JSON.stringify(block.input).slice(0, 120)})`);
          }
        }
      } else if (role === 'tool') {
        for (const block of message.content ?? []) {
          if (block.type === 'tool_result') {
            const resultText =
              Array.isArray(block.content)
                ? block.content.filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join(' ')
                : String(block.content ?? '');
            const preview = resultText.slice(0, 120).replace(/\n/g, ' ');
            console.log(`[tool_result] ${preview}${resultText.length > 120 ? '…' : ''}`);
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
