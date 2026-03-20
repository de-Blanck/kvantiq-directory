import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const sourceSchema = z.object({
  type: z.enum(['doi', 'arxiv', 'url', 'website', 'press-release']),
  url: z.string().url(),
  title: z.string().optional(),
  authors: z.string().optional(),
  datePublished: z.string().optional(),
  dateAccessed: z.string().optional(),
});

const newsSchema = z.object({
  title: z.string(),
  excerpt: z.string().optional(),
  url: z.string().url(),
  source: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be ISO 8601 format: YYYY-MM-DD'),
});

const companies = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/companies' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    country: z.string(),
    region: z.enum(['nordics', 'dach', 'western-europe', 'southern-europe', 'eastern-europe', 'uk']),
    type: z.enum(['hardware', 'software', 'cloud', 'consulting', 'research', 'hybrid', 'other']),
    tags: z.array(z.string()),
    founded: z.number().optional(),
    description: z.string(),
    website: z.string().url(),
    featured: z.boolean().default(false),
    logo: z.string().optional(),
    headquarters: z.string().optional(),
    employees: z.string().optional(),
    funding: z.string().optional(),
    sources: z.array(sourceSchema).min(2),
    news: z.array(newsSchema).default([]),
  }),
});

const benchmarks = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/benchmarks' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    algorithm: z.string(),
    category: z.enum(['optimization', 'simulation', 'machine-learning', 'cryptography', 'chemistry', 'other']),
    tags: z.array(z.string()),
    description: z.string(),
    hardware: z.string().optional(),
    framework: z.string().optional(),
    qubits: z.number().optional(),
    reproducible: z.boolean().default(false),
    datePublished: z.string().optional(),
    sources: z.array(sourceSchema).min(2),
    news: z.array(newsSchema).default([]),
  }),
});

const useCases = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/use-cases' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    industry: z.string(),
    category: z.enum(['optimization', 'simulation', 'machine-learning', 'cryptography', 'chemistry', 'finance', 'logistics', 'energy', 'other']),
    tags: z.array(z.string()),
    description: z.string(),
    problem: z.string(),
    approach: z.string(),
    results: z.string().optional(),
    companies: z.array(z.string()).optional(),
    sources: z.array(sourceSchema).min(2),
    news: z.array(newsSchema).default([]),
  }),
});

const challenges = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/challenges' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    organizer: z.string(),
    tags: z.array(z.string()),
    description: z.string(),
    website: z.string().url(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
    status: z.enum(['upcoming', 'active', 'completed']).default('completed'),
    prizes: z.string().optional(),
    location: z.string().optional(),
    sources: z.array(sourceSchema).min(2),
    news: z.array(newsSchema).default([]),
  }),
});

const resources = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/resources' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    type: z.enum(['framework', 'course', 'funding', 'tool', 'community', 'publication', 'other']),
    tags: z.array(z.string()),
    description: z.string(),
    website: z.string().url(),
    openSource: z.boolean().default(false),
    free: z.boolean().default(false),
    language: z.string().optional(),
    provider: z.string().optional(),
    sources: z.array(sourceSchema).min(2),
    news: z.array(newsSchema).default([]),
  }),
});

export const collections = { companies, benchmarks, 'use-cases': useCases, challenges, resources };
