#!/usr/bin/env npx tsx
/**
 * MCP server providing Resend email and ClickUp task tools.
 * Claude Code CLI connects to this via stdio.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Resend } from 'resend';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const DATA_DIR = resolve(import.meta.dirname, '../../data');

function appendPendingJson(filename: string, entry: unknown): void {
  const filePath = resolve(DATA_DIR, filename);
  let existing: unknown[] = [];
  try {
    existing = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (!Array.isArray(existing)) existing = [];
  } catch { /* file doesn't exist or invalid */ }
  existing.push(entry);
  writeFileSync(filePath, JSON.stringify(existing, null, 2));
}

// --- Resend setup ---
const resend = new Resend(process.env.RESEND_API_KEY);

// --- ClickUp setup ---
const CLICKUP_API = 'https://api.clickup.com/api/v2';
const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;
const CLICKUP_LIST_ID = process.env.CLICKUP_LIST_ID;

// --- MCP Server ---
const server = new McpServer({
  name: 'kvantiq-tools',
  version: '1.0.0',
});

// --- Send Email Tool ---
server.tool(
  'send_email',
  'Send an email via Resend. Use for weekly digest and major event alerts.',
  {
    to: z.string().describe('Recipient email address'),
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Email body text'),
    is_urgent: z.boolean().describe('If true, prefix subject with [URGENT]'),
  },
  async ({ to, subject, body, is_urgent }) => {
    try {
      const result = await resend.emails.send({
        from: 'Kvantiq Agent <notifications@kvantiq.studio>',
        to: [to],
        subject: is_urgent ? `[URGENT] ${subject}` : subject,
        text: body,
      });
      return { content: [{ type: 'text', text: `Email sent successfully. ID: ${result.data?.id}` }] };
    } catch (error) {
      appendPendingJson('pending-email.json', {
        to, subject, body, is_urgent,
        failed_at: new Date().toISOString(),
        error: String(error),
      });
      return { content: [{ type: 'text', text: `Email failed: ${error}. Saved to data/pending-email.json for retry.` }] };
    }
  }
);

// --- Create ClickUp Task Tool ---
server.tool(
  'create_clickup_task',
  'Create a task in ClickUp for items needing human judgment. Use for: removal approvals, new category proposals, borderline entries, major events.',
  {
    title: z.string().describe('Task title'),
    description: z.string().describe('Task description with context'),
    priority: z.number().min(1).max(4).describe('1=Urgent, 2=High, 3=Normal, 4=Low'),
    tags: z.string().describe('Comma-separated tags'),
  },
  async ({ title, description, priority, tags }) => {
    if (!CLICKUP_TOKEN || !CLICKUP_LIST_ID) {
      appendPendingJson('pending-clickup-tasks.json', {
        title, description, priority, tags,
        failed_at: new Date().toISOString(),
        reason: 'not_configured',
      });
      return { content: [{ type: 'text', text: 'ClickUp not configured. Task saved to data/pending-clickup-tasks.json.' }] };
    }

    try {
      const response = await fetch(`${CLICKUP_API}/list/${CLICKUP_LIST_ID}/task`, {
        method: 'POST',
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: title,
          description,
          priority,
          tags: tags.split(',').map(t => t.trim()),
          notify_all: true,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return { content: [{ type: 'text', text: `ClickUp API error (${response.status}): ${err}` }] };
      }

      const data = await response.json() as { id: string; url: string };
      return { content: [{ type: 'text', text: `ClickUp task created: ${data.url}` }] };
    } catch (error) {
      appendPendingJson('pending-clickup-tasks.json', {
        title, description, priority, tags,
        failed_at: new Date().toISOString(),
        error: String(error),
      });
      return { content: [{ type: 'text', text: `ClickUp failed: ${error}. Saved to data/pending-clickup-tasks.json.` }] };
    }
  }
);

// --- Start server ---
const transport = new StdioServerTransport();
await server.connect(transport);
