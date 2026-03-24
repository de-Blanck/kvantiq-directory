import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const CLICKUP_API = 'https://api.clickup.com/api/v2';
const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;
const CLICKUP_LIST_ID = process.env.CLICKUP_LIST_ID;

export const createClickUpTask = tool(
  'create_clickup_task',
  'Create a task in ClickUp for items needing human judgment. Use for: removal approvals, new category proposals, borderline entries, major events.',
  {
    title: z.string(),
    description: z.string(),
    priority: z.number(),
    tags: z.string(),
  },
  async (args) => {
    if (!CLICKUP_TOKEN || !CLICKUP_LIST_ID) {
      return { content: [{ type: 'text' as const, text: 'ClickUp not configured. Task logged locally.' }] };
    }

    try {
      const response = await fetch(`${CLICKUP_API}/list/${CLICKUP_LIST_ID}/task`, {
        method: 'POST',
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: args.title,
          description: args.description,
          priority: args.priority,
          tags: args.tags.split(',').map(t => t.trim()),
          notify_all: true,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return { content: [{ type: 'text' as const, text: `ClickUp API error (${response.status}): ${err}` }] };
      }

      const data = await response.json() as { id: string; url: string };
      return { content: [{ type: 'text' as const, text: `ClickUp task created: ${data.url}` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `ClickUp failed: ${error}. Task logged locally.` }] };
    }
  }
);
