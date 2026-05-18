/**
 * Kvantiq Weekly Agent — prompt builder.
 *
 * Composes the per-run prompt (date, sources, pending items, workflow phases)
 * and writes it to data/weekly-agent-prompt.md. The GitHub Action then feeds
 * this file to anthropics/claude-code-base-action authenticated via
 * CLAUDE_CODE_OAUTH_TOKEN — work is billed to the subscription pool, not API.
 *
 * The agentic loop, tool wiring, and turn limits previously lived in this
 * file via @anthropic-ai/claude-agent-sdk. That moved to the action so the
 * subscription auth path works.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const PROMPT_OUT = join(DATA_DIR, 'weekly-agent-prompt.md');

const SOURCES_JSON = readFileSync(join(DATA_DIR, 'sources.json'), 'utf-8');

function loadPending(filename: string): string | null {
  const filePath = join(DATA_DIR, filename);
  if (!existsSync(filePath)) return null;
  try {
    const content = readFileSync(filePath, 'utf-8').trim();
    if (content && content !== '[]' && content !== '{}') {
      console.log(`[weekly-agent] Found pending file: ${filename}`);
      return content;
    }
  } catch {
    // ignore read errors
  }
  return null;
}

const pendingDiscoveryQueue = loadPending('discovery-queue.json');
const pendingClickUpTasks = loadPending('pending-clickup-tasks.json');
const pendingEmail = loadPending('pending-email.json');

function buildPendingContext(): string {
  const sections: string[] = [];
  if (pendingDiscoveryQueue) sections.push(`## Pending Discovery Queue (from previous run)\n\n\`\`\`json\n${pendingDiscoveryQueue}\n\`\`\``);
  if (pendingClickUpTasks) sections.push(`## Pending ClickUp Tasks (failed to send last run)\n\n\`\`\`json\n${pendingClickUpTasks}\n\`\`\``);
  if (pendingEmail) sections.push(`## Pending Email (failed to send last run)\n\n\`\`\`json\n${pendingEmail}\n\`\`\``);
  return sections.length > 0
    ? `\n\n---\n\n# PENDING ITEMS FROM PREVIOUS RUN\n\n${sections.join('\n\n')}`
    : '';
}

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

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(PROMPT_OUT, AGENT_PROMPT, 'utf-8');

console.log(`[weekly-agent] Built prompt for ${TODAY} (${AGENT_PROMPT.length} chars)`);
console.log(`[weekly-agent] Wrote: ${PROMPT_OUT}`);
console.log(`[weekly-agent] The action will now invoke Claude Code with this prompt under subscription auth.`);
