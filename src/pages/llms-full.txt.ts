import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const companies = await getCollection('companies');
  const benchmarks = await getCollection('benchmarks');
  const useCases = await getCollection('use-cases');
  const challenges = await getCollection('challenges');
  const resources = await getCollection('resources');

  let content = '# Kvantiq Directory — Full Content\n\n';
  content += '> The European directory for quantum computing.\n\n';

  content += '## Companies\n\n';
  for (const c of companies) {
    content += `### ${c.data.name}\n`;
    content += `${c.data.description}\n`;
    content += `- Country: ${c.data.country}\n`;
    content += `- Type: ${c.data.type}\n`;
    content += `- Website: ${c.data.website}\n`;
    if (c.data.founded) content += `- Founded: ${c.data.founded}\n`;
    content += `- Tags: ${c.data.tags.join(', ')}\n\n`;
  }

  content += '## Benchmarks\n\n';
  for (const b of benchmarks) {
    content += `### ${b.data.name}\n`;
    content += `${b.data.description}\n`;
    content += `- Algorithm: ${b.data.algorithm}\n`;
    content += `- Category: ${b.data.category}\n`;
    if (b.data.qubits) content += `- Qubits: ${b.data.qubits}\n`;
    content += `- Reproducible: ${b.data.reproducible ? 'Yes' : 'No'}\n\n`;
  }

  content += '## Use Cases\n\n';
  for (const u of useCases) {
    content += `### ${u.data.name}\n`;
    content += `${u.data.description}\n`;
    content += `- Industry: ${u.data.industry}\n`;
    content += `- Problem: ${u.data.problem}\n`;
    content += `- Approach: ${u.data.approach}\n\n`;
  }

  content += '## Challenges\n\n';
  for (const ch of challenges) {
    content += `### ${ch.data.name}\n`;
    content += `${ch.data.description}\n`;
    content += `- Organizer: ${ch.data.organizer}\n`;
    content += `- Website: ${ch.data.website}\n\n`;
  }

  content += '## Resources\n\n';
  for (const r of resources) {
    content += `### ${r.data.name}\n`;
    content += `${r.data.description}\n`;
    content += `- Type: ${r.data.type}\n`;
    content += `- Website: ${r.data.website}\n`;
    content += `- Open Source: ${r.data.openSource ? 'Yes' : 'No'}\n\n`;
  }

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
