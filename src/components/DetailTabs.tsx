import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface NewsItem {
  title: string;
  excerpt?: string;
  url: string;
  source: string;
  date: string;
}

interface RelatedItem {
  slug: string;
  name: string;
  description: string;
  collection: string;
  tags: string[];
  href: string;
}

interface DetailTabsProps {
  children: React.ReactNode;
  news: NewsItem[];
  related: RelatedItem[];
  sources: { type: string; url: string; title?: string; dateAccessed?: string }[];
  onCustomize: () => void;
}

type TabId = 'overview' | 'news' | 'related';

const BADGE_COLORS: Record<string, string> = {
  benchmarks: 'bg-info/15 text-info',
  'use-cases': 'bg-accent-glow text-accent',
  companies: 'bg-warn/15 text-warn',
  challenges: 'bg-error/15 text-error',
  resources: 'bg-elevated text-text-muted',
};

function collectionLabel(collection: string): string {
  if (collection === 'use-cases') return 'Use Case';
  return collection.slice(0, -1).replace(/^\w/, c => c.toUpperCase());
}

export default function DetailTabs({ children, news, related, onCustomize }: DetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const prefersReducedMotion = useReducedMotion();

  // Stagger timings — children fade+rise in sequence. Reduced-motion users see
  // instant mount/unmount (no stagger, no translate, no duration).
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: prefersReducedMotion
        ? { staggerChildren: 0, delayChildren: 0 }
        : { staggerChildren: 0.06, delayChildren: 0.04 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.22,
        ease: 'easeOut' as const,
      },
    },
  };

  // No Sources tab — sources are always visible at bottom (handled by DetailPage)
  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(news.length > 0 ? [{ id: 'news' as TabId, label: 'Latest News' }] : []),
    ...(related.length >= 2 ? [{ id: 'related' as TabId, label: 'Related' }] : []),
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center overflow-x-auto rounded-xl border border-border bg-base p-1 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-150 ${
              activeTab === tab.id
                ? 'bg-elevated text-accent shadow-subtle'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={onCustomize}
          className="eyebrow shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-text-muted hover:text-text-secondary transition-colors"
        >
          ⚙ Customize
        </button>
      </div>

      {/* Tab content — stagger children on every tab change.
          Using mode="wait" + unique key forces a fresh mount on each switch so
          the stagger replays every time (not just first entry). */}
      <div className="relative min-h-[200px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: prefersReducedMotion ? 0 : 0.12 } }}
          >
            {activeTab === 'overview' && (
              // Overview is composed of children (DashboardGrid). The grid's own
              // motion.div cards already handle per-card stagger, but we wrap
              // in a single itemVariants child so the overview as a whole fades
              // in consistently with other tabs' first-item timing.
              <motion.div variants={itemVariants}>{children}</motion.div>
            )}

            {activeTab === 'news' && (
              <div className="flex flex-col gap-3">
                <motion.div
                  variants={itemVariants}
                  className="eyebrow text-text-muted mb-1"
                >
                  {news.length} article{news.length !== 1 ? 's' : ''} · Updated weekly via AI sweep
                </motion.div>
                {news.map((item, i) => (
                  <motion.a
                    key={i}
                    variants={itemVariants}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card-hover block rounded-xl border border-border bg-surface p-6 cursor-pointer"
                  >
                    <div className="h-md text-text-primary mb-2">{item.title}</div>
                    {item.excerpt && (
                      <div className="body-sm text-text-secondary mb-3">{item.excerpt}</div>
                    )}
                    <div className="flex gap-2 eyebrow text-text-muted">
                      <span>{item.date}</span>
                      <span>·</span>
                      <span className="text-accent">{item.source} ↗</span>
                    </div>
                  </motion.a>
                ))}
              </div>
            )}

            {activeTab === 'related' && (
              <div className="grid gap-3 sm:grid-cols-2">
                {related.map(item => (
                  <motion.a
                    key={item.slug}
                    variants={itemVariants}
                    href={item.href}
                    className="card-hover flex items-start gap-3 rounded-xl border border-border bg-surface p-5 cursor-pointer"
                  >
                    <span className={`eyebrow shrink-0 rounded px-2 py-0.5 ${BADGE_COLORS[item.collection] || BADGE_COLORS.resources}`}>
                      {collectionLabel(item.collection)}
                    </span>
                    <div>
                      <div className="h-sm text-text-primary">{item.name}</div>
                      <div className="body-sm mt-1 text-text-secondary line-clamp-2">{item.description}</div>
                    </div>
                  </motion.a>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}
