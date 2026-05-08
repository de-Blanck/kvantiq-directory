import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEventSchema } from './event.ts';

test('buildEventSchema produces valid Event JSON-LD', () => {
  const result = buildEventSchema({
    name: 'TechBBQ Hackathon 2026',
    slug: 'techbbq-2026',
    description: 'Quantum hackathon at TechBBQ Copenhagen.',
    organizer: 'Kvantiq Studio',
    website: 'https://techbbq.dk/hackathon',
    dateStart: '2026-09-15',
    dateEnd: '2026-09-17',
    status: 'upcoming',
    prizes: '€50k total prize pool',
    location: 'Copenhagen, Denmark',
    eligibility: 'Open to anyone',
    tags: ['hackathon', 'denmark'],
  });

  assert.equal(result['@type'], 'Event');
  assert.equal(result.name, 'TechBBQ Hackathon 2026');
  assert.equal(result.startDate, '2026-09-15');
  assert.equal(result.endDate, '2026-09-17');
  assert.equal(result.eventStatus, 'https://schema.org/EventScheduled');
  const organizer = result.organizer as Record<string, string>;
  assert.equal(organizer.name, 'Kvantiq Studio');
});

test('buildEventSchema maps status correctly', () => {
  const r1 = buildEventSchema({
    name: 'X', slug: 'x', description: '...', organizer: 'Y', website: 'https://x.com',
    status: 'completed', tags: ['t'],
  });
  assert.equal(r1.eventStatus, 'https://schema.org/EventScheduled');
});
