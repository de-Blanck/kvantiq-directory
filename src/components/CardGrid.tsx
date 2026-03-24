import { motion } from 'framer-motion';

export interface CardItem {
  href: string;
  name: string;
  description: string;
  tags: string[];
  meta: string;
  badge?: string;
  badgeColor?: string;
  /** If true, open link in a new tab (for external resources) */
  external?: boolean;
}

interface CardGridProps {
  items: CardItem[];
}

export default function CardGrid({ items }: CardGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => (
        <motion.a
          key={item.href}
          href={item.href}
          {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
          className="block rounded-xl border border-border bg-surface p-6 transition-all duration-200 hover:border-accent/20 hover:shadow-elevated"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-heading text-[15px] font-semibold text-text-primary">{item.name}</h3>
            {item.badge && (
              <span className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-[10px] font-medium ${item.badgeColor || 'text-accent bg-accent-glow'}`}>
                {item.badge}
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-[11px] text-text-muted">{item.meta}</p>
          <p className="mt-2 text-[13px] text-text-secondary leading-relaxed line-clamp-2">{item.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.tags.slice(0, 3).map(tag => (
              <span key={tag} className="rounded-md border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                {tag}
              </span>
            ))}
          </div>
        </motion.a>
      ))}
    </div>
  );
}
