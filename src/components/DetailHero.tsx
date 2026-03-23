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
      className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-base to-surface p-7 mb-4"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/[0.03] blur-3xl" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:justify-between lg:items-start">
        <div className="flex-1">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-accent">
            {type}
          </div>
          <h1 className="mt-1 font-heading text-[32px] font-bold leading-tight tracking-[-0.02em] text-text-primary">
            {name}
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">{meta}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map(tag => (
              <span
                key={tag}
                className="rounded-full border border-accent/20 bg-accent-glow px-3 py-1 font-mono text-[11px] text-text-secondary"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-info px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-info/85"
              >
                ↗ {websiteLabel || 'Visit Website'}
              </a>
            )}
            <a
              href="#sources"
              className="inline-flex items-center rounded-lg border border-border px-5 py-2 text-[13px] font-medium text-text-secondary transition-colors hover:border-text-muted"
            >
              Sources ({sourceCount})
            </a>
          </div>
        </div>

        {stats.length > 0 && (
          <div className="flex flex-wrap gap-3 lg:gap-4">
            {stats.map(stat => (
              <div
                key={stat.label}
                className="rounded-xl border border-border bg-elevated px-5 py-3 text-center min-w-[100px]"
              >
                <div className="font-heading text-xl font-bold text-text-primary">{stat.value}</div>
                <div className="mt-0.5 font-mono text-[10px] text-text-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
