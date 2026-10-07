'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Languages, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from './icon-button';

/**
 * Floating black panel (radius 36) docked above the composer. Top row of circular controls;
 * children render below (smart-reply pills, tone check result, etc.).
 */
export function AiTray({
  open,
  onClose,
  aiEnabled,
  onToggleAi,
  translateActive,
  onTranslate,
  stepper,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  aiEnabled: boolean;
  onToggleAi: () => void;
  translateActive?: boolean;
  onTranslate?: () => void;
  stepper?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.section
          aria-label="AI tools"
          initial={{ y: 24, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 24, opacity: 0, scale: 0.97 }}
          className={cn('rounded-sheet bg-ink p-3 text-white', className)}
        >
          <div className="flex items-center gap-2">
            <IconButton label="Formatting" tone="hub" size="sm">
              <span className="text-body font-semibold">Aa</span>
            </IconButton>
            <IconButton
              label={aiEnabled ? 'Turn AI off for this chat' : 'Turn AI on for this chat'}
              aria-pressed={aiEnabled}
              tone="hub"
              size="sm"
              onClick={onToggleAi}
            >
              <span
                aria-hidden
                className={cn(
                  'size-4 rounded-pill transition-colors',
                  aiEnabled ? 'bg-highlight' : 'border-2 border-white/40',
                )}
              />
            </IconButton>
            <IconButton
              label="Translate"
              tone={translateActive ? 'ai' : 'hub'}
              aria-pressed={translateActive}
              size="sm"
              onClick={onTranslate}
            >
              <Languages />
            </IconButton>
            {stepper}
            <IconButton label="Close AI tools" tone="hub" size="sm" onClick={onClose}>
              <X />
            </IconButton>
          </div>
          {children && <div className="mt-3">{children}</div>}
        </motion.section>
      )}
    </AnimatePresence>
  );
}

/** Cream suggestion pill inside the AI tray. */
export function SuggestionPill({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="min-h-11 shrink-0 rounded-pill bg-cream px-4 py-2 text-left text-body text-ink"
    >
      {children}
    </motion.button>
  );
}
