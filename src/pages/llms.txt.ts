import { getCollection } from 'astro:content';
import { publishedOnly } from '../lib/source-bar';
import type { APIRoute } from 'astro';
import { loadEventsFeed } from '../lib/events/load';
import { EVENT_TYPES, EVENT_TYPE_LABELS } from '../lib/events/labels';

// Generated rather than served from public/, so the counts and the geographic
// claim cannot drift from the data. The static version claimed coverage of
// "Nordics and DACH" long after the directory spanned 14 countries.
export const GET: APIRoute = async () => {
  const companies = publishedOnly(await getCollection('companies'));
  const benchmarks = publishedOnly(await getCollection('benchmarks'));
  const useCases = publishedOnly(await getCollection('use-cases'));
  const challenges = publishedOnly(await getCollection('challenges'));
  const resources = publishedOnly(await getCollection('resources'));

  const total = companies.length + benchmarks.length + useCases.length + challenges.length + resources.length;
  const countries = new Set(companies.map((c) => c.data.country)).size;
  const events = await loadEventsFeed();
  const eventTypes = EVENT_TYPES.map((type) => EVENT_TYPE_LABELS[type]).join(', ');

  const content = `# Kvantiq Directory

> The European directory for quantum computing — companies, benchmarks,
> use cases, challenges, and resources, covering ${companies.length} companies
> across ${countries} European countries.

Kvantiq Directory is a curated, structured database of the European
quantum computing ecosystem. All data is open and machine-readable.

${total} entries are published. Every entry carries at least three credible,
independent sources; entries that cannot meet that bar are withheld from the
listings rather than published unverified, and are listed openly at
/transparency/audit/.

## Companies

- [Quantum Companies Index](/companies/): Browse all ${companies.length} listed quantum companies
- [Companies by Country](/companies/country/finland/): Filter by country

## Benchmarks

- [Quantum Benchmarks](/benchmarks/): ${benchmarks.length} reproducible quantum computing benchmarks

## Use Cases

- [Hybrid Quantum-Classical Use Cases](/use-cases/): ${useCases.length} real-world applications

## Challenges

- [Quantum Challenges](/challenges/): ${challenges.length} competitions and hackathons

## Resources

- [Frameworks, Courses, Funding](/resources/): ${resources.length} European quantum resources

## Events

An event is a dated change to a directory entry: what happened, when, a one-line
summary, and the source it came from, with a quote that an automated check found
on the source page. Each event has one of six types: ${eventTypes}.
Funding events add the round, the amount (or "undisclosed") and the investors.
${events.count} events are published.

- [Events](/events/): Every published event, newest first, filterable by type, country and text
- [Events feed](/events.json): The same events as JSON
- [Events feed schema](/event.schema.json): JSON Schema for /events.json

## Transparency

- [How entries are verified](/about/): Methodology, source bar, and ethics
- [Audit dashboard](/transparency/audit/): Directory health and withheld entries
- [Sweep log](/transparency/sweeps/): Every automated content sweep, with its results

## Optional

- [Full content dump](/llms-full.txt): Every entry with descriptions and sources
`;

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
