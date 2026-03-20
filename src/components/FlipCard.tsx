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
    info: { bg: 'bg-[#EFF6FF]', border: 'border-[#BFDBFE]', text: 'text-[#1E40AF]', accent: 'text-[#2563EB]' },
    ok: { bg: 'bg-[#ECFDF5]', border: 'border-[#A7F3D0]', text: 'text-[#065F46]', accent: 'text-[#059669]' },
    warn: { bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]', text: 'text-[#92400E]', accent: 'text-[#D97706]' },
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
        className="relative h-[160px]"
      >
        {/* Front */}
        <div
          className={`absolute inset-0 rounded-xl border ${c.border} ${c.bg} p-5 flex flex-col justify-center`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <p className={`font-mono text-[9px] font-medium uppercase tracking-[0.5px] ${c.text}`} style={{ opacity: 0.7 }}>
            {frontLabel}
          </p>
          <p className={`mt-2 font-mono text-3xl font-semibold ${c.accent}`}>
            {frontValue}
          </p>
          {frontSub && (
            <p className={`mt-1 text-sm ${c.text}`}>
              {frontSub}
            </p>
          )}
          <p className={`mt-auto font-mono text-[9px] ${c.text}`} style={{ opacity: 0.5 }}>
            Hover to flip ↻
          </p>
        </div>

        {/* Back */}
        <div
          className={`absolute inset-0 rounded-xl border ${c.border} ${c.bg} p-5 flex flex-col justify-center`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <p className={`text-sm leading-relaxed ${c.text}`}>
            {backText}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
