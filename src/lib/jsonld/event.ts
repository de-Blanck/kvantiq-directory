interface ChallengeInput {
  name: string;
  slug: string;
  description: string;
  organizer: string;
  website: string;
  dateStart?: string;
  dateEnd?: string;
  status: 'upcoming' | 'active' | 'completed';
  prizes?: string;
  location?: string;
  eligibility?: string;
  teamSize?: string;
  registrationDeadline?: string;
  tags: string[];
}

export function buildEventSchema(c: ChallengeInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: c.name,
    description: c.description,
    url: `https://directory.kvantiq.studio/challenges/${c.slug}/`,
    keywords: c.tags,
    ...(c.dateStart ? { startDate: c.dateStart } : {}),
    ...(c.dateEnd ? { endDate: c.dateEnd } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    organizer: {
      '@type': 'Organization',
      name: c.organizer,
      url: c.website,
    },
    ...(c.prizes ? { offers: { '@type': 'Offer', description: c.prizes } } : {}),
    ...(c.location ? { location: { '@type': 'Place', name: c.location } } : {}),
    ...(c.eligibility ? { eligibilityToWorkRequirement: c.eligibility } : {}),
  };
}
