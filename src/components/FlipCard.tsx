import { useState } from 'react';
import { motion } from 'framer-motion';

interface FlipCardProps {
  frontLabel: string;
  frontValue: string;
  frontSub?: string;
  backText: string;
  color?: 'info' | 'ok' | 'warn';
}

export default function FlipCard({ frontLabel, frontValue, frontSub, backText, color = 'info' }: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);

  const colorMap = {
    info: { bg: 'bg-info/10', border: 'border-info/20', text: 'text-info', accent: 'text-info' },
    ok: { bg: 'bg-accent/10', border: 'border-accent/20', text: 'text-accent', accent: 'text-accent' },
    warn: { bg: 'bg-warn/10', border: 'border-warn/20', text: 'text-warn', accent: 'text-warn' },
  };

  const c = colorMap[color];

  return (
    <div
      className="cursor-pointer"
      style={{ perspective: '1000px' }}
      onClick={() => setFlipped(!flipped)}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative h-[280px] md:h-[300px]"
      >
        {/* Front */}
        <div
          className={`absolute inset-0 overflow-hidden rounded-xl border ${c.border} ${c.bg} p-5 flex flex-col justify-center`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <p className={`eyebrow ${c.text} opacity-75`}>
            {frontLabel}
          </p>
          <p className={`mt-3 data-lg ${c.accent}`} style={{ fontSize: '28px' }}>
            {frontValue}
          </p>
          {frontSub && (
            <p className={`mt-1 body-default ${c.text}`}>
              {frontSub}
            </p>
          )}
          <p className={`mt-auto eyebrow ${c.text} opacity-55`}>
            Hover to flip ↻
          </p>
        </div>

        {/* Back */}
        <div
          className={`absolute inset-0 overflow-hidden rounded-xl border ${c.border} ${c.bg} p-5 flex flex-col justify-center`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <p className={`body-sm ${c.text}`}>
            {backText}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
