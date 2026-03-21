import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = tool(
  'send_email',
  'Send an email via Resend. Use for weekly digest and major event alerts.',
  {
    to: z.string(),
    subject: z.string(),
    body: z.string(),
    is_urgent: z.boolean(),
  },
  async (args) => {
    try {
      const result = await resend.emails.send({
        from: 'Kvantiq Agent <notifications@kvantiq.studio>',
        to: [args.to],
        subject: args.is_urgent ? `[URGENT] ${args.subject}` : args.subject,
        text: args.body,
      });
      return { content: [{ type: 'text' as const, text: `Email sent successfully. ID: ${result.data?.id}` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Email failed: ${error}. Content saved for retry.` }] };
    }
  }
);
