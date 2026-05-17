import { motion } from 'framer-motion';

interface HeroStat {
  value: string;
  label: string;
}

interface DetailHeroProps {
  type: string;
  name: string;
  meta: string;
  description: string;
  tags: string[];
  stats: HeroStat[];
  websiteUrl?: string;
  websiteLabel?: string;
  sourceCount: number;
}

/**
 * Aligned Columns — promoted from hero-variants/HeroAligned.astro (Iteration 1).
 *
 * Honours the DS two-font rule:
 *   Left column = PROSE (Geist). Right column = DATA (IBM Plex Mono).
 *
 * The font-family change alone does most of the visual separation — stat
 * values read as data, not as more body copy. Eyebrows on each column share
 * the same top baseline so "Company" (accent) <-> "Specifications" (muted)
 * read as paired section markers.
 */
export default function DetailHero({
  type, name, meta, description, tags, stats, websiteUrl, websiteLabel, sourceCount
}: DetailHeroProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-base to-surface p-8 md:p-10 mb-6"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/[0.04] blur-3xl" />

      <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-12">
        {/* Prose tower (Geist) */}
        <div className="min-w-0">
          <div className="eyebrow text-accent">{type}</div>
          <h1 className="h-xl mt-3 text-text-primary">{name}</h1>
          <p className="body-sm mt-3 text-text-muted">{meta}</p>
          <p className="body-lg mt-5 text-text-secondary">{description}</p>

          {tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="eyebrow rounded-full border border-accent/20 bg-accent-glow px-3 py-1 text-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-quantum inline-flex items-center gap-1 rounded-lg bg-info px-5 py-2.5 text-sm font-semibold text-white"
              >
                ↗ {websiteLabel || 'Visit Website'}
              </a>
            )}
            <a
              href="#sources"
              className="inline-flex items-center rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-text-muted hover:text-text-primary"
            >
              Sources ({sourceCount})
            </a>
          </div>
        </div>

        {/* Data tower (Mono) */}
        {stats.length > 0 && (
          <aside className="lg:border-l lg:border-border lg:pl-8">
            <div className="eyebrow text-text-muted">Specifications</div>
            <dl className="mt-4 divide-y divide-border">
              {stats.map(s => (
                <div key={s.label} className="py-3 first:pt-0 last:pb-0">
                  <dt className="eyebrow text-text-muted">{s.label}</dt>
                  <dd className="mt-1.5 data-md text-text-primary break-words">{s.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        )}
      </div>
    </motion.div>
  );
}
