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
          className="card-hover block rounded-xl border border-border bg-surface p-6"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="h-md text-text-primary">{item.name}</h3>
            {item.badge && (
              <span className={`eyebrow shrink-0 rounded-md px-2 py-0.5 ${item.badgeColor || 'text-accent bg-accent-glow'}`}>
                {item.badge}
              </span>
            )}
          </div>
          <p className="eyebrow mt-1 text-text-muted">{item.meta}</p>
          <p className="body-sm mt-2 text-text-secondary line-clamp-2">{item.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.tags.slice(0, 3).map(tag => (
              <span key={tag} className="eyebrow rounded-md border border-border bg-elevated px-1.5 py-0.5 text-text-muted">
                {tag}
              </span>
            ))}
          </div>
        </motion.a>
      ))}
    </div>
  );
}
