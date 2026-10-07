'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Languages, Reply, SmilePlus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { IconButton } from './icon-button';

export type MessageAction = 'reply' | 'copy' | 'translate' | 'react';

/**
 * Long-press overlay: everything else blurs, the message gets the highlighter marker (rendered by the
 * caller via `<Bubble marked>`), and a floating pill of circular actions appears above it.
 */
export function MessageMenu({
  open,
  onClose,
  onAction,
  children,
  extra,
}: {
  open: boolean;
  onClose: () => void;
  onAction: (a: MessageAction) => void;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const actions: { a: MessageAction; label: string; icon: React.ReactNode }[] = [
    { a: 'reply', label: 'Reply', icon: <Reply /> },
    { a: 'copy', label: 'Copy', icon: <Copy /> },
    { a: 'translate', label: 'Translate', icon: <Languages /> },
    { a: 'react', label: 'React', icon: <SmilePlus /> },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Message actions"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close message actions"
            onClick={onClose}
            className="absolute inset-0 bg-cream/40 backdrop-blur-md"
          />
          <motion.div
            initial={{ y: 10, scale: 0.9, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, scale: 0.9, opacity: 0 }}
            className="relative mb-3 flex items-center gap-1.5 rounded-pill bg-ink p-1.5"
          >
            {actions.map(({ a, label, icon }, i) => (
              <IconButton
                key={a}
                ref={i === 0 ? first : undefined}
                label={label}
                tone="hub"
                size="sm"
                onClick={() => onAction(a)}
              >
                {icon}
              </IconButton>
            ))}
          </motion.div>
          <div className="relative flex w-full max-w-md flex-col">{children}</div>
          {extra && <div className="relative mt-3">{extra}</div>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
