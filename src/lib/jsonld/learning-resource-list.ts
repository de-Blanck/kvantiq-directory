interface ResourceInput {
  name: string;
  slug: string;
  description: string;
  type: string;
  website: string;
  free?: boolean;
  openSource?: boolean;
  language?: string;
  provider?: string;
  tags: string[];
}

export function buildLearningResourceList(resources: ResourceInput[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'European Quantum Computing Resources',
    description: 'Curated framework, courses, tools, and community resources for European quantum computing.',
    numberOfItems: resources.length,
    itemListElement: resources.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'LearningResource',
        name: r.name,
        description: r.description,
        url: r.website,
        learningResourceType: r.type,
        keywords: r.tags,
        ...(r.free ? { isAccessibleForFree: true } : {}),
        ...(r.provider ? { provider: { '@type': 'Organization', name: r.provider } } : {}),
        ...(r.language ? { inLanguage: r.language } : {}),
      },
    })),
  };
}
