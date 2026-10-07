'use client';

import { motion } from 'framer-motion';
import { Avatar } from './avatar';

/** Small floating avatar bubble with animated dots. */
export function TypingIndicator({
  name,
  seed,
  src,
}: {
  name: string;
  seed: string;
  src?: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      role="status"
      aria-label={`${name} is typing`}
      className="flex items-center gap-2 self-start"
    >
      <Avatar seed={seed} src={src} name="" size={32} />
      <span className="flex h-9 items-center gap-1 rounded-pill bg-cream-deep px-3.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-pill bg-ink/60"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </span>
    </motion.div>
  );
}
