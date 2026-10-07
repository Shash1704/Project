'use client';

import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 64px black FAB with a 4px ink ring: where it overlaps a card's edge it reads as cut out of the card.
 * The "+" rotates 45° while its menu is open.
 */
export function Fab({
  open,
  onClick,
  label = 'New chat',
  className,
}: {
  open?: boolean;
  onClick?: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-expanded={open}
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      className={cn(
        'flex size-fab items-center justify-center rounded-pill bg-ink text-white ring-4 ring-ink',
        className,
      )}
    >
      <motion.span animate={{ rotate: open ? 45 : 0 }} className="flex">
        <Plus className="size-7" strokeWidth={2.5} />
      </motion.span>
    </motion.button>
  );
}
