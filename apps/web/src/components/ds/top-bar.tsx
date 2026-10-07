'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { IconButton } from './icon-button';

/**
 * Conversation top bar. The giant title (`ConversationTitle`) lives at the top of the scrolling
 * message list and scrolls away; this bar's compact title fades in as it goes.
 */
export function ConversationTopBar({
  title,
  onBack,
  right,
  scrollRef,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  scrollRef: React.RefObject<HTMLElement | null>;
}) {
  const { scrollY } = useScroll({ container: scrollRef });
  const smallOpacity = useTransform(scrollY, [40, 90], [0, 1]);
  const smallY = useTransform(scrollY, [40, 90], [6, 0]);

  return (
    <header className="flex shrink-0 items-center gap-2 px-screen pt-[max(env(safe-area-inset-top),12px)] pb-2">
      {onBack && (
        <IconButton label="Back to chats" onClick={onBack}>
          <ChevronLeft className="!size-6" />
        </IconButton>
      )}
      <motion.p
        style={{ opacity: smallOpacity, y: smallY }}
        className="min-w-0 flex-1 truncate text-card-title"
      >
        {title}
      </motion.p>
      <div className="flex shrink-0 items-center">{right}</div>
    </header>
  );
}

export function ConversationTitle({
  title,
  subtitle,
  layoutId,
}: {
  title: string;
  subtitle?: React.ReactNode;
  layoutId?: string;
}) {
  return (
    <div className="pb-4">
      <motion.h1 layoutId={layoutId} className="text-display md:text-display-desktop break-words">
        {title}
      </motion.h1>
      {subtitle && <div className="mt-1 text-caption text-muted">{subtitle}</div>}
    </div>
  );
}
