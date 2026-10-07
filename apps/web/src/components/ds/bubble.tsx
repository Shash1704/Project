'use client';

import { motion } from 'framer-motion';
import { forwardRef } from 'react';
import { motion as m } from '@pulse/ui/tokens';
import { cn } from '@/lib/utils';
import { Ticks, type DeliveryStatus } from './ticks';

export interface BubbleProps {
  outgoing: boolean;
  children: React.ReactNode;
  time: string;
  status?: DeliveryStatus;
  author?: string;
  edited?: boolean;
  /** Briefly flash with the AI highlight (e.g. when jumped to from Catch Me Up). */
  flash?: boolean;
  /** Draw the yellow highlighter marker (message actions). */
  marked?: boolean;
  onContextMenu?: (e: React.MouseEvent | React.TouchEvent) => void;
  className?: string;
  footer?: React.ReactNode;
}

export const Bubble = forwardRef<HTMLDivElement, BubbleProps>(function Bubble(
  {
    outgoing,
    children,
    time,
    status,
    author,
    edited,
    flash,
    marked,
    onContextMenu,
    className,
    footer,
  },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      layout="position"
      initial={{ opacity: 0, y: 12, scale: outgoing ? 0.96 : 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={outgoing ? m.springBouncy : { duration: m.messageEnterMs / 1000 }}
      onContextMenu={onContextMenu}
      className={cn(
        'flex max-w-[82%] flex-col',
        outgoing ? 'items-end self-end' : 'items-start self-start',
        className,
      )}
    >
      {author && !outgoing && <span className="mb-1 ml-3 text-caption text-muted">{author}</span>}
      <div
        className={cn(
          'relative rounded-bubble px-4 py-2.5 text-body break-words whitespace-pre-wrap transition-shadow duration-500',
          outgoing ? 'bg-ink text-cream' : 'bg-cream-deep text-ink',
          flash && 'ring-4 ring-highlight',
        )}
      >
        {marked ? (
          <mark className="-mx-1 -rotate-[0.6deg] rounded-[3px_6px_4px_7px] bg-highlight box-decoration-clone px-1 py-px text-ink">
            {children}
          </mark>
        ) : (
          children
        )}
        {footer}
        <span
          className={cn(
            'mt-1 flex items-center justify-end gap-1 text-caption',
            outgoing ? 'text-cream/70' : 'text-muted',
          )}
        >
          {edited && <span>edited ·</span>}
          <time>{time}</time>
          {outgoing && status && <Ticks status={status} />}
        </span>
      </div>
    </motion.div>
  );
});
