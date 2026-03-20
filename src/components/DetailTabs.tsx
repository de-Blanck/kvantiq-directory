import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

interface SourceItem {
  type: string;
  url: string;
  title?: string;
  dateAccessed?: string;
}

interface DetailTabsProps {
  children: React.ReactNode;
  news: NewsItem[];
  related: RelatedItem[];
  sources: SourceItem[];
  onCustomize: () => void;
}

type TabId = 'overview' | 'news' | 'related' | 'sources';

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

export default function DetailTabs({ children, news, related, sources, onCustomize }: DetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(news.length > 0 ? [{ id: 'news' as TabId, label: 'Latest News' }] : []),
    ...(related.length >= 2 ? [{ id: 'related' as TabId, label: 'Related' }] : []),
    { id: 'sources', label: 'Sources' },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center overflow-x-auto rounded-xl border border-border bg-base p-1 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-lg px-5 py-2.5 text-[13px] font-medium transition-all duration-150 ${
              activeTab === tab.id
                ? 'bg-surface text-accent shadow-glow'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={onCustomize}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 font-mono text-[11px] text-text-muted hover:text-text-secondary transition-colors"
        >
          ⚙ Customize
        </button>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && children}

          {activeTab === 'news' && (
            <div className="flex flex-col gap-3">
              <div className="font-mono text-[12px] text-text-muted mb-1">
                {news.length} article{news.length !== 1 ? 's' : ''} · Updated weekly via AI sweep
              </div>
              {news.map((item, i) => (
                <a
                  key={i}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-border bg-surface p-6 transition-colors hover:border-accent/20"
                >
                  <div className="text-[16px] font-medium text-text-primary mb-1.5">{item.title}</div>
                  {item.excerpt && (
                    <div className="text-[14px] text-text-secondary leading-[1.7] mb-3">{item.excerpt}</div>
                  )}
                  <div className="flex gap-2 font-mono text-[12px] text-text-muted">
                    <span>{item.date}</span>
                    <span>·</span>
                    <span className="text-accent">{item.source} ↗</span>
                  </div>
                </a>
              ))}
            </div>
          )}

          {activeTab === 'related' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {related.map(item => (
                <a
                  key={item.slug}
                  href={item.href}
                  className="flex items-start gap-3 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/20"
                >
                  <span className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${BADGE_COLORS[item.collection] || BADGE_COLORS.resources}`}>
                    {collectionLabel(item.collection)}
                  </span>
                  <div>
                    <div className="text-[13px] font-medium text-text-primary">{item.name}</div>
                    <div className="mt-0.5 text-[12px] text-text-secondary line-clamp-2">{item.description}</div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {activeTab === 'sources' && (
            <div id="sources" className="grid gap-0 sm:grid-cols-2">
              {sources.map((src, i) => (
                <div key={i} className="flex items-start gap-3 border-b border-border py-4 px-1">
                  <span className="mt-0.5 text-[14px]">
                    {src.type === 'arxiv' ? '📄' : src.type === 'doi' ? '🔬' : '🌐'}
                  </span>
                  <div>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] text-accent hover:underline"
                    >
                      {src.title || src.url}
                    </a>
                    <div className="mt-0.5 font-mono text-[12px] text-text-muted">
                      {src.type}{src.dateAccessed ? ` · accessed ${src.dateAccessed}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
