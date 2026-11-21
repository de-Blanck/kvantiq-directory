import type { APIRoute } from 'astro';
import { eventsFeedJsonSchema } from '../lib/events/feed';

export const GET: APIRoute = () => new Response(JSON.stringify(eventsFeedJsonSchema()), {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
