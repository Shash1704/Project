'use client';

import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';
import { IconButton } from './icon-button';

/** Cream bottom sheet, top radius 36, drag-down or Escape to dismiss. */
export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const drag = useDragControls();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
          <motion.button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            onClick={onClose}
            className="absolute inset-0 bg-ink/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className={cn(
              'relative flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-sheet bg-cream text-ink',
              className,
            )}
          >
            <div
              onPointerDown={(e) => drag.start(e)}
              className="flex cursor-grab touch-none justify-center pt-3 pb-1"
              aria-hidden
            >
              <span className="h-1 w-10 rounded-pill bg-ink/20" />
            </div>
            <div className="flex items-start gap-3 px-screen pt-2">
              <div className="min-w-0 flex-1">
                {eyebrow}
                <h2 id={titleId} className="text-display">
                  {title}
                </h2>
              </div>
              <IconButton ref={closeRef} label="Close" onClick={onClose}>
                <X />
              </IconButton>
            </div>
            <div className="overflow-y-auto px-screen pt-4 pb-[max(env(safe-area-inset-bottom),24px)]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
