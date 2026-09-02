import type { APIRoute } from 'astro';
import { Resvg } from '@resvg/resvg-js';
import { getCollection } from 'astro:content';
import { renderOgSvg } from '../../../lib/og-image-template.ts';

const COLLECTIONS = ['companies', 'benchmarks', 'use-cases', 'challenges'] as const;
type CollectionId = (typeof COLLECTIONS)[number];

const EYEBROWS: Record<CollectionId, string> = {
  companies: 'COMPANY',
  benchmarks: 'BENCHMARK',
  'use-cases': 'USE CASE',
  challenges: 'CHALLENGE',
};

export async function getStaticPaths() {
  const paths: Array<{ params: { collection: CollectionId; slug: string } }> = [];
  for (const collection of COLLECTIONS) {
    const entries = await getCollection(collection);
    for (const entry of entries) {
      paths.push({ params: { collection, slug: entry.data.slug } });
    }
  }
  return paths;
}

function buildSubhead(collection: CollectionId, data: Record<string, unknown>): string {
  switch (collection) {
    case 'companies': {
      const country = (data.country as string) ?? '';
      const type = ((data.type as string) ?? '').replace(/^\w/, (c) => c.toUpperCase());
      const founded = data.founded ? `Founded ${data.founded}` : '';
      return [country, type, founded].filter(Boolean).join(' · ');
    }
    case 'benchmarks': {
      const algorithm = (data.algorithm as string) ?? '';
      const hardware = (data.hardware as string) ?? '';
      const qubits = data.qubits ? `${data.qubits} qubits` : '';
      return [algorithm, hardware, qubits].filter(Boolean).join(' · ');
    }
    case 'use-cases': {
      const industry = (data.industry as string) ?? '';
      const category = (data.category as string) ?? '';
      return [industry, category].filter(Boolean).join(' · ');
    }
    case 'challenges': {
      const organizer = (data.organizer as string) ?? '';
      const dateStart = (data.dateStart as string) ?? '';
      const status = (data.status as string) ?? '';
      return [organizer, dateStart, status].filter(Boolean).join(' · ');
    }
  }
}

export const GET: APIRoute = async ({ params }) => {
  const collection = params.collection as CollectionId;
  const slug = params.slug as string;

  const entries = await getCollection(collection);
  const entry = entries.find((e) => e.data.slug === slug);
  if (!entry) {
    return new Response('Not found', { status: 404 });
  }

  const svg = await renderOgSvg({
    eyebrow: EYEBROWS[collection],
    heading: (entry.data as { name: string }).name,
    subhead: buildSubhead(collection, entry.data as Record<string, unknown>),
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  const png = resvg.render().asPng();

  // Buffer is not a BodyInit; a Uint8Array view over the same memory is.
  return new Response(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
};
