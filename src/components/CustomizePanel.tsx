import { motion, AnimatePresence } from 'framer-motion';

export interface CardConfig {
  id: string;
  label: string;
  visible: boolean;
  fullWidth: boolean;
}

interface CustomizePanelProps {
  open: boolean;
  onClose: () => void;
  cards: CardConfig[];
  onToggle: (id: string) => void;
  onReset: () => void;
}

export default function CustomizePanel({ open, onClose, cards, onToggle, onReset }: CustomizePanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-void/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed right-0 top-0 z-50 h-full w-80 border-l border-border bg-surface p-6 overflow-y-auto"
          >
            <h3 className="font-heading text-base font-semibold text-text-primary">Customize Layout</h3>
            <p className="mt-1 text-[13px] text-text-secondary">Toggle cards on or off. Saved automatically.</p>

            <div className="mt-6">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-3">
                Visible Cards
              </div>
              {cards.map(card => (
                <div key={card.id} className="flex items-center justify-between border-b border-border py-3">
                  <span className="text-[13px] text-text-primary">{card.label}</span>
                  <button
                    onClick={() => onToggle(card.id)}
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium transition-colors ${
                      card.visible
                        ? 'bg-accent/15 text-accent'
                        : 'bg-elevated text-text-muted'
                    }`}
                  >
                    {card.visible ? 'ON' : 'OFF'}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={onClose}
                className="btn-quantum flex-1 rounded-lg bg-info px-4 py-2.5 text-[13px] font-semibold text-void"
              >
                Done
              </button>
              <button
                onClick={onReset}
                className="rounded-lg border border-border px-4 py-2.5 text-[13px] text-text-muted hover:text-text-secondary transition-colors"
              >
                Reset
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
