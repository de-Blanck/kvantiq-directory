interface BenchmarkInput {
  name: string;
  slug: string;
  description: string;
  algorithm: string;
  category: string;
  hardware?: string;
  framework?: string;
  qubits?: number;
  keyMetrics?: Array<{ metric: string; value: string; unit?: string }>;
  significance?: string;
  tags: string[];
}

export function buildDatasetSchema(b: BenchmarkInput): Record<string, unknown> {
  const variableMeasured = b.keyMetrics?.map(m => ({
    '@type': 'PropertyValue',
    name: m.metric,
    value: m.value,
    ...(m.unit ? { unitText: m.unit } : {}),
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: b.name,
    description: b.description,
    url: `https://directory.kvantiq.studio/benchmarks/${b.slug}/`,
    measurementTechnique: b.algorithm,
    keywords: b.tags,
    ...(variableMeasured && variableMeasured.length > 0 ? { variableMeasured } : {}),
    ...(b.hardware ? { hardwareRequirements: b.hardware } : {}),
    ...(b.framework ? { citation: b.framework } : {}),
    ...(b.significance ? { abstract: b.significance } : {}),
    creator: {
      '@type': 'Organization',
      name: 'Kvantiq Directory',
      url: 'https://directory.kvantiq.studio',
    },
    license: 'https://creativecommons.org/licenses/by/4.0/',
  };
}
