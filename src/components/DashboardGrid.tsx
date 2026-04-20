import { motion } from 'framer-motion';

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

export default function DashboardGrid({ cards, visibleCardIds, fullWidthCardIds }: DashboardGridProps) {
  const visibleCards = cards.filter(c => visibleCardIds.includes(c.id));

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {visibleCards.map((card, i) => {
        const isFull = fullWidthCardIds.includes(card.id);
        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className={`card-hover rounded-xl border border-border bg-surface p-6 ${
              isFull ? 'md:col-span-2' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="eyebrow-lg text-text-primary">
                {card.label}
              </span>
            </div>
            {card.content}
          </motion.div>
        );
      })}
    </div>
  );
}
