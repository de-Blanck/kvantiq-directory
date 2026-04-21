import { useMemo } from 'react';
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
  /** Optional group keys — mirror of the fields from tableData so grouping works in card view. */
  [field: string]: string | string[] | boolean | undefined;
}

interface CardGridProps {
  items: CardItem[];
  /** Optional: item field to group cards by. When set, cards are split into sections per unique value. */
  groupBy?: string;
  /** Display label for the active groupBy field (e.g. "Country"). */
  groupByLabel?: string;
}

function titleCase(val: string): string {
  return val ? val.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
}

function renderCards(items: CardItem[], indexOffset = 0) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => (
        <motion.a
          key={item.href}
          href={item.href}
          {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: (indexOffset + i) * 0.04 }}
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

export default function CardGrid({ items, groupBy }: CardGridProps) {
  // When grouping is active, bucket items by the groupBy field value.
  // Groups sort alphabetically; within a group, existing order is preserved.
  const groups = useMemo(() => {
    if (!groupBy) return null;
    const buckets = new Map<string, CardItem[]>();
    for (const item of items) {
      const raw = item[groupBy];
      const key = raw === undefined || raw === null || raw === '' ? '—' : String(raw);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(item);
    }
    return Array.from(buckets.entries())
      .filter(([, list]) => list.length > 0)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [items, groupBy]);

  if (groups) {
    let offset = 0;
    return (
      <div className="space-y-8">
        {groups.map(([groupKey, list]) => {
          const section = (
            <section key={groupKey}>
              <div className="mb-4 flex items-baseline gap-3 border-b border-border pb-2">
                <h2 className="h-sm text-text-primary">{titleCase(groupKey)}</h2>
                <span className="eyebrow text-text-muted">
                  {list.length} {list.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              {renderCards(list, offset)}
            </section>
          );
          offset += list.length;
          return section;
        })}
      </div>
    );
  }

  return renderCards(items);
}
