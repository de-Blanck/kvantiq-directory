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

      <div className="relative z-10 flex flex-col gap-8">
        <div className="min-w-0">
          <div className="eyebrow text-accent">
            {type}
          </div>
          <h1 className="h-xl mt-3 text-text-primary">
            {name}
          </h1>
          <p className="body-default mt-3 text-text-secondary">{meta}</p>

          {tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
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

          <div className="mt-6 flex flex-wrap gap-3">
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-quantum inline-flex items-center gap-1 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-void"
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

        {stats.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {stats.map(stat => {
              const isLong = stat.value.length > 20;
              return (
                <div
                  key={stat.label}
                  className={`rounded-xl border border-border bg-elevated px-6 py-4 ${isLong ? 'text-left max-w-[280px]' : 'text-center min-w-[110px]'}`}
                >
                  <div className={`text-text-primary ${isLong ? 'body-sm font-semibold' : 'data-lg'}`}>{stat.value}</div>
                  <div className="eyebrow mt-1.5 text-text-muted">{stat.label}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
