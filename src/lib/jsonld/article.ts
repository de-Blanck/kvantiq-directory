interface UseCaseInput {
  name: string;
  slug: string;
  description: string;
  industry: string;
  category: string;
  problem: string;
  approach: string;
  results?: string;
  companies?: string[];
  tags: string[];
}

export function buildArticleSchema(u: UseCaseInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: u.name,
    description: u.description,
    url: `https://directory.kvantiq.studio/use-cases/${u.slug}/`,
    articleSection: u.industry,
    keywords: u.tags,
    about: [
      { '@type': 'Thing', name: u.industry },
      ...(u.companies ?? []).map(c => ({ '@type': 'Organization', name: c })),
    ],
    abstract: `Problem: ${u.problem}\n\nApproach: ${u.approach}`,
    ...(u.results ? { citation: u.results } : {}),
    publisher: {
      '@type': 'Organization',
      name: 'Kvantiq Directory',
      url: 'https://directory.kvantiq.studio',
    },
  };
}
