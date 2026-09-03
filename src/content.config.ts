import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Reusable: non-empty string (rejects "", " ", etc.)
const nonEmpty = z.string().min(1).transform(s => s.trim()).pipe(z.string().min(1, 'Must not be empty or whitespace-only'));

// Reusable: description must be at least 20 characters
const description = z.string().min(20, 'Description must be at least 20 characters');

const sourceSchema = z.object({
  type: z.enum(['doi', 'arxiv', 'url', 'website', 'press-release']),
  url: z.string().url(),
  title: nonEmpty.optional(),
  authors: nonEmpty.optional(),
  datePublished: nonEmpty.optional(),
  dateAccessed: nonEmpty.optional(),
});

const newsSchema = z.object({
  title: nonEmpty,
  excerpt: nonEmpty.optional(),
  url: z.string().url(),
  source: nonEmpty,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be ISO 8601 format: YYYY-MM-DD'),
});

const companies = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/companies' }),
  schema: z.object({
    name: nonEmpty,
    slug: nonEmpty,
    country: nonEmpty,
    region: z.enum(['nordics', 'dach', 'western-europe', 'southern-europe', 'eastern-europe', 'uk']),
    type: z.enum(['hardware', 'software', 'cloud', 'consulting', 'research', 'hybrid', 'other']),
    tags: z.array(nonEmpty).min(1, 'Must have at least 1 tag'),
    founded: z.number().optional(),
    description,
    website: z.string().url(),
    featured: z.boolean().default(false),
    logo: nonEmpty.optional(),
    headquarters: nonEmpty.optional(),
    employees: nonEmpty.optional(),
    funding: nonEmpty.optional(),
    accessModel: nonEmpty.optional(),
    products: z.array(z.object({
      name: nonEmpty,
      description: z.string().min(10),
      url: z.string().url().optional(),
    })).optional(),
    highlights: z.array(nonEmpty).optional(),
    sources: z.array(sourceSchema).min(3, 'Needs at least 3 sources — see the source bar in CLAUDE.md'),
    news: z.array(newsSchema).default([]),
  }),
});

const benchmarks = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/benchmarks' }),
  schema: z.object({
    name: nonEmpty,
    slug: nonEmpty,
    algorithm: nonEmpty,
    category: z.enum(['optimization', 'simulation', 'machine-learning', 'cryptography', 'chemistry', 'other']),
    tags: z.array(nonEmpty).min(1, 'Must have at least 1 tag'),
    description,
    hardware: nonEmpty.optional(),
    framework: nonEmpty.optional(),
    qubits: z.number().optional(),
    reproducible: z.boolean().default(false),
    datePublished: nonEmpty.optional(),
    keyMetrics: z.array(z.object({
      metric: nonEmpty,
      value: nonEmpty,
      unit: nonEmpty.optional(),
    })).optional(),
    significance: z.string().min(20).optional(),
    sources: z.array(sourceSchema).min(3, 'Needs at least 3 sources — see the source bar in CLAUDE.md'),
    news: z.array(newsSchema).default([]),
  }),
});

const useCases = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/use-cases' }),
  schema: z.object({
    name: nonEmpty,
    slug: nonEmpty,
    industry: nonEmpty,
    category: z.enum(['optimization', 'simulation', 'machine-learning', 'cryptography', 'chemistry', 'finance', 'logistics', 'energy', 'other']),
    tags: z.array(nonEmpty).min(1, 'Must have at least 1 tag'),
    description,
    problem: z.string().min(20, 'Problem must be at least 20 characters'),
    approach: z.string().min(20, 'Approach must be at least 20 characters'),
    results: nonEmpty.optional(),
    companies: z.array(nonEmpty).optional(),
    sources: z.array(sourceSchema).min(3, 'Needs at least 3 sources — see the source bar in CLAUDE.md'),
    news: z.array(newsSchema).default([]),
  }),
});

const challenges = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/challenges' }),
  schema: z.object({
    name: nonEmpty,
    slug: nonEmpty,
    organizer: nonEmpty,
    tags: z.array(nonEmpty).min(1, 'Must have at least 1 tag'),
    description,
    website: z.string().url(),
    dateStart: nonEmpty.optional(),
    dateEnd: nonEmpty.optional(),
    status: z.enum(['upcoming', 'active', 'completed']).default('completed'),
    prizes: nonEmpty.optional(),
    location: nonEmpty.optional(),
    eligibility: nonEmpty.optional(),
    teamSize: nonEmpty.optional(),
    registrationDeadline: nonEmpty.optional(),
    problemDomains: z.array(nonEmpty).optional(),
    // Stays at 2: qhack-2025 and quantum-game-jam-2025 are deliberately withheld
    // by the publish gate (src/lib/source-bar.ts), not deleted. Raising this to 3
    // would turn an unpublished entry into a build failure. Raise it once
    // `npm run audit:sources --strict --collection challenges` clears.
    sources: z.array(sourceSchema).min(2),
    news: z.array(newsSchema).default([]),
  }),
});

const resources = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/resources' }),
  schema: z.object({
    name: nonEmpty,
    slug: nonEmpty,
    type: z.enum(['framework', 'course', 'funding', 'tool', 'community', 'publication', 'other']),
    tags: z.array(nonEmpty).min(1, 'Must have at least 1 tag'),
    description,
    website: z.string().url(),
    openSource: z.boolean().default(false),
    free: z.boolean().default(false),
    language: nonEmpty.optional(),
    provider: nonEmpty.optional(),
    lastUpdated: nonEmpty.optional(),
    maturity: z.enum(['experimental', 'stable', 'mature', 'archived']).optional(),
    communitySize: nonEmpty.optional(),
    sources: z.array(sourceSchema).min(3, 'Needs at least 3 sources — see the source bar in CLAUDE.md'),
    news: z.array(newsSchema).default([]),
  }),
});

export const collections = { companies, benchmarks, 'use-cases': useCases, challenges, resources };
