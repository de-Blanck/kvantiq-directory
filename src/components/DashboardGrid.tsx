import { useState, useCallback } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface CardData {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface DashboardGridProps {
  collection: string;
  cards: CardData[];
  visibleCardIds: string[];
  fullWidthCardIds: string[];
}

export default function DashboardGrid({ collection, cards, visibleCardIds, fullWidthCardIds }: DashboardGridProps) {
  const layoutKey = `kvantiq-layout-${collection}-default`;

  const generateLayout = useCallback(() => {
    const visible = cards.filter(c => visibleCardIds.includes(c.id));
    let y = 0;
    let col = 0;
    return visible.map(card => {
      const isFull = fullWidthCardIds.includes(card.id);
      if (isFull) {
        if (col === 1) { y += 2; col = 0; }
        const item = { i: card.id, x: 0, y, w: 2, h: 2, minH: 1 };
        y += 2;
        col = 0;
        return item;
      } else {
        const item = { i: card.id, x: col, y, w: 1, h: 2, minH: 1 };
        if (col === 1) { y += 2; col = 0; } else { col = 1; }
        return item;
      }
    });
  }, [cards, visibleCardIds, fullWidthCardIds]);

  const [layouts, setLayouts] = useState(() => {
    if (typeof window === 'undefined') return { lg: generateLayout() };
    const saved = localStorage.getItem(layoutKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch { /* fall through */ }
    }
    return { lg: generateLayout(), sm: generateLayout().map(l => ({ ...l, w: 1, x: 0 })) };
  });

  const onLayoutChange = useCallback((_: unknown, allLayouts: Record<string, unknown>) => {
    setLayouts(allLayouts);
    if (typeof window !== 'undefined') {
      localStorage.setItem(layoutKey, JSON.stringify(allLayouts));
    }
  }, [layoutKey]);

  const visibleCards = cards.filter(c => visibleCardIds.includes(c.id));

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      breakpoints={{ lg: 1100, md: 768, sm: 0 }}
      cols={{ lg: 2, md: 2, sm: 1 }}
      rowHeight={80}
      draggableHandle=".card-drag"
      onLayoutChange={onLayoutChange}
      isResizable={false}
    >
      {visibleCards.map(card => (
        <div key={card.id} className="rounded-xl border border-border bg-surface p-6 transition-colors hover:border-accent/10">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-text-primary">
              {card.label}
            </span>
            <span className="card-drag cursor-move text-[12px] tracking-[2px] text-border hover:text-text-muted transition-colors">
              &#8286;&#8286;
            </span>
          </div>
          {card.content}
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
