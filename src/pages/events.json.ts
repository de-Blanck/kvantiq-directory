import type { APIRoute } from 'astro';
import { loadEventsFeed } from '../lib/events/load';

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify(await loadEventsFeed()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
