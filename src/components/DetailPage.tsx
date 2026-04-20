import { useState } from 'react';
import DetailHero from './DetailHero';
import DetailTabs from './DetailTabs';
import DashboardGrid from './DashboardGrid';

/**
 * Products list — each row is either:
 *  - a full-row anchor that opens the product URL in a new tab (when url exists)
 *  - a plain static div (when no url) — cursor stays default, nothing to click
 */
function ProductsList({ products }: { products: { name: string; description: string; url?: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      {products.map((p, i) => {
        const inner = (
          <>
            <div className="flex items-center gap-2">
              <span className="h-sm text-text-primary">{p.name}</span>
              {p.url && <span className="text-accent text-xs">↗</span>}
            </div>
            <p className="body-sm text-text-secondary mt-1">{p.description}</p>
          </>
        );
        if (p.url) {
          return (
            <a
              key={i}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group -mx-2 cursor-pointer rounded-lg px-2 py-1.5 transition-colors hover:bg-elevated/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              aria-label={`${p.name} (opens in new tab)`}
            >
              {inner}
            </a>
          );
        }
        return (
          <div key={i} className="-mx-2 px-2 py-1.5">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Highlights list — clicking a highlight toggles a line-clamp vs. full display.
 * Short highlights (one line) still get a cursor-pointer for consistency; the
 * toggle is a no-op when already fully visible.
 */
function HighlightsList({ highlights }: { highlights: string[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <ul className="flex flex-col gap-1.5">
      {highlights.map((h, i) => {
        const isExpanded = expanded.has(i);
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-expanded={isExpanded}
              className={`group flex w-full items-start gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-elevated/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 body-sm text-text-secondary ${
                isExpanded ? '' : 'line-clamp-2'
              }`}
            >
              <span aria-hidden="true">•</span>
              <span className="flex-1">{h}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Dashboard-card news list — top 3 news items. Entire row is clickable and
 * opens the article URL in a new tab. Matches behavior of Latest News tab.
 */
function NewsDashboardList({ news }: { news: { title: string; excerpt?: string; url: string; source: string; date: string }[] }) {
  return (
    <div className="flex flex-col gap-4">
      {news.slice(0, 3).map((item, i) => (
        <a
          key={i}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group -mx-2 block cursor-pointer rounded-lg px-2 py-2 border-b border-border pb-4 last:border-0 last:pb-2 transition-colors hover:bg-elevated/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          aria-label={`${item.title} — ${item.source} (opens in new tab)`}
        >
          <div className="h-sm text-text-primary group-hover:text-accent transition-colors">{item.title}</div>
          <div className="mt-1 flex gap-2 eyebrow text-text-muted">
            <span>{item.date}</span>
            <span className="text-accent">{item.source} ↗</span>
          </div>
        </a>
      ))}
    </div>
  );
}

interface RelatedItem {
  slug: string;
  name: string;
  description: string;
  collection: string;
  tags: string[];
  href: string;
}

interface CardConfig {
  id: string;
  label: string;
  visible: boolean;
  fullWidth: boolean;
}

interface DetailPageProps {
  type: string;
  name: string;
  meta: string;
  description: string;
  tags: string[];
  stats: { value: string; label: string }[];
  websiteUrl?: string;
  websiteLabel?: string;
  collection: string;
  news: { title: string; excerpt?: string; url: string; source: string; date: string }[];
  related: RelatedItem[];
  sources: { type: string; url: string; title?: string; dateAccessed?: string }[];
  extraCards?: { id: string; label: string; content: React.ReactNode }[];
  products?: { name: string; description: string; url?: string }[];
  highlights?: string[];
  keyMetrics?: { metric: string; value: string; unit?: string }[];
  significance?: string;
  linkedCompanies?: { name: string; slug: string }[];
  /** Optional smart cross-links rendered as a chip row under the overview description.
   *  Examples: "All companies ↗", "See more in Denmark →", "All Quantum Hardware →".
   *  Each opens in same tab unless external is true. */
  overviewLinks?: { label: string; href: string; external?: boolean }[];
}

// Only content cards — no metrics (in hero), no sources (always at bottom)
const DEFAULT_CARDS: CardConfig[] = [
  { id: 'overview', label: 'Overview', visible: true, fullWidth: true },
  { id: 'news', label: 'Latest News', visible: true, fullWidth: false },
  { id: 'related', label: 'Related', visible: true, fullWidth: false },
];

export default function DetailPage(props: DetailPageProps) {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [cardConfigs, setCardConfigs] = useState<CardConfig[]>(() => {
    return DEFAULT_CARDS.map(c => ({
      ...c,
      visible: c.id === 'news' ? props.news.length > 0 :
               c.id === 'related' ? props.related.length >= 2 :
               c.visible,
    }));
  });

  const toggleCard = (id: string) => {
    setCardConfigs(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const resetCards = () => {
    setCardConfigs(DEFAULT_CARDS.map(c => ({
      ...c,
      visible: c.id === 'news' ? props.news.length > 0 :
               c.id === 'related' ? props.related.length >= 2 :
               c.visible,
    })));
  };

  const badgeColors: Record<string, string> = {
    benchmarks: 'bg-info/15 text-info',
    'use-cases': 'bg-accent-glow text-accent',
    companies: 'bg-warn/15 text-warn',
    challenges: 'bg-error/15 text-error',
    resources: 'bg-elevated text-text-muted',
  };

  // Build content cards (no metrics, no sources)
  const dashboardCards = [
    {
      id: 'overview',
      label: '', // No label — tab already says "Overview"
      content: (
        <div className="flex flex-col gap-4">
          <p className="body-default text-text-secondary">{props.description}</p>
          {props.overviewLinks && props.overviewLinks.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {props.overviewLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.href}
                  {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="eyebrow rounded-full border border-border bg-base px-3 py-1.5 text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
                >
                  {link.label} {link.external ? '↗' : '→'}
                </a>
              ))}
            </div>
          )}
        </div>
      ),
    },
    ...(props.products && props.products.length > 0 ? [{
      id: 'products',
      label: 'Products',
      content: <ProductsList products={props.products} />,
    }] : []),
    ...(props.highlights && props.highlights.length > 0 ? [{
      id: 'highlights',
      label: 'Key Highlights',
      content: <HighlightsList highlights={props.highlights} />,
    }] : []),
    ...(props.keyMetrics && props.keyMetrics.length > 0 ? [{
      id: 'key-metrics',
      label: 'Key Metrics',
      content: (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {props.keyMetrics.map((m, i) => (
            <div key={i} className="rounded-lg border border-border bg-base px-4 py-3">
              <div className="eyebrow text-text-muted">{m.metric}</div>
              <div className="mt-1.5 data-lg text-text-primary leading-tight">
                {m.value}
                {m.unit && <span className="body-sm font-normal text-text-muted ml-1.5">{m.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      ),
    }] : []),
    ...(props.significance ? [{
      id: 'significance',
      label: 'Why It Matters',
      content: <p className="body-default text-text-secondary">{props.significance}</p>,
    }] : []),
    ...(props.linkedCompanies && props.linkedCompanies.length > 0 ? [{
      id: 'companies',
      label: 'Companies Involved',
      content: (
        <div className="flex flex-wrap gap-2">
          {props.linkedCompanies.map(c => (
            <a key={c.slug} href={`/companies/${c.slug}/`} className="eyebrow rounded-lg border border-border px-3 py-1.5 text-text-primary hover:border-accent/30 hover:text-accent transition-colors">
              {c.name}
            </a>
          ))}
        </div>
      ),
    }] : []),
    ...(props.news.length > 0 ? [{
      id: 'news',
      label: 'Latest News',
      content: <NewsDashboardList news={props.news} />,
    }] : []),
    ...(props.related.length >= 2 ? [{
      id: 'related',
      label: 'Related',
      content: (
        <div className="flex flex-col gap-2">
          {props.related.slice(0, 3).map(item => {
            const label = item.collection === 'use-cases' ? 'Use Case' : item.collection.slice(0, -1).replace(/^\w/, c => c.toUpperCase());
            return (
              <a key={item.slug} href={item.href} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0 hover:text-accent transition-colors">
                <span className={`eyebrow shrink-0 rounded px-2 py-0.5 ${badgeColors[item.collection] || badgeColors.resources}`}>
                  {label}
                </span>
                <span className="body-sm text-text-primary">{item.name}</span>
              </a>
            );
          })}
        </div>
      ),
    }] : []),
    ...(props.extraCards || []).map(card => ({
      ...card,
      content: typeof card.content === 'string'
        ? <p className="body-default text-text-secondary">{card.content}</p>
        : card.content,
    })),
  ];

  // Customizable card IDs (exclude overview — always shown)
  const customizableCards = cardConfigs.filter(c => c.id !== 'overview');

  return (
    <div className="mx-auto max-w-4xl">
      <DetailHero
        type={props.type}
        name={props.name}
        meta={props.meta}
        description={props.description}
        tags={props.tags}
        stats={props.stats}
        websiteUrl={props.websiteUrl}
        websiteLabel={props.websiteLabel}
        sourceCount={props.sources.length}
      />

      <DetailTabs
        news={props.news}
        related={props.related}
        sources={props.sources}
        onCustomize={() => setCustomizeOpen(o => !o)}
      >
        {/* Inline customize dropdown */}
        {customizeOpen && customizableCards.length > 0 && (
          <div className="mb-4 rounded-xl border border-border bg-base p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="eyebrow text-text-muted">
                Show / Hide Cards
              </span>
              <button
                onClick={resetCards}
                className="eyebrow text-text-muted hover:text-text-secondary transition-colors"
              >
                Reset
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {customizableCards.map(card => (
                <button
                  key={card.id}
                  onClick={() => toggleCard(card.id)}
                  className={`eyebrow rounded-lg px-3 py-1.5 transition-colors ${
                    card.visible
                      ? 'bg-accent-glow text-accent border border-accent/30'
                      : 'bg-elevated text-text-muted border border-border'
                  }`}
                >
                  {card.label} {card.visible ? '✓' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <DashboardGrid
          collection={props.collection}
          cards={dashboardCards}
          visibleCardIds={[
            ...cardConfigs.filter(c => c.visible).map(c => c.id),
            ...(props.products?.length ? ['products'] : []),
            ...(props.highlights?.length ? ['highlights'] : []),
            ...(props.keyMetrics?.length ? ['key-metrics'] : []),
            ...(props.significance ? ['significance'] : []),
            ...(props.linkedCompanies?.length ? ['companies'] : []),
            ...(props.extraCards || []).map(c => c.id),
          ]}
          fullWidthCardIds={[
            ...cardConfigs.filter(c => c.fullWidth).map(c => c.id),
            ...(props.extraCards || []).map(c => c.id),
          ]}
        />
      </DetailTabs>

      {/* Sources — always visible at bottom, subtle, not a card */}
      <div id="sources" className="mt-8 border-t border-border pt-6 scroll-mt-20">
        <div className="eyebrow text-text-muted mb-4">
          Sources
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1">
          {props.sources.map((src, i) => (
            <div key={i} className="flex items-start gap-2.5 py-2">
              <span className="mt-0.5 body-sm text-text-muted">
                {src.type === 'arxiv' ? '📄' : src.type === 'doi' ? '🔬' : '🌐'}
              </span>
              <div>
                <a href={src.url} target="_blank" rel="noopener noreferrer" className="body-sm text-accent hover:underline">
                  {src.title || src.url}
                </a>
                <div className="eyebrow text-text-muted">
                  {src.type}{src.dateAccessed ? ` · accessed ${src.dateAccessed}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
