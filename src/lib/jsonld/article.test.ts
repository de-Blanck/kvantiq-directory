import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArticleSchema } from './article.ts';

test('buildArticleSchema produces valid Article JSON-LD', () => {
  const result = buildArticleSchema({
    name: 'Portfolio optimization at JP Morgan',
    slug: 'jpm-portfolio-optimization',
    description: 'Quantum-classical hybrid for credit risk portfolios.',
    industry: 'finance',
    category: 'optimization',
    problem: 'Combinatorial complexity at >500 assets exceeds classical solvers in time budget.',
    approach: 'QAOA with classical warm-start; hybrid runtime via IBM Quantum Network.',
    results: '12% Sharpe improvement on backtest.',
    companies: ['IBM', 'JP Morgan'],
    tags: ['finance', 'qaoa'],
  });

  assert.equal(result['@type'], 'Article');
  assert.equal(result.headline, 'Portfolio optimization at JP Morgan');
  assert.equal(result.articleSection, 'finance');
  assert.equal(result.url, 'https://directory.kvantiq.studio/use-cases/jpm-portfolio-optimization/');
  assert.deepEqual(result.keywords, ['finance', 'qaoa']);
});
