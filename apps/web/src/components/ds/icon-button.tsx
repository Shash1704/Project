'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type IconTone = 'primary' | 'secondary' | 'hub' | 'cream' | 'ai';
export type IconSize = 'sm' | 'md' | 'lg';

const toneClass: Record<IconTone, string> = {
  primary: 'bg-ink text-white',
  secondary: 'bg-taupe-glass text-ink',
  hub: 'bg-ink-raised text-white',
  cream: 'bg-cream text-ink',
  ai: 'bg-highlight text-ink',
};

const sizeClass: Record<IconSize, string> = {
  sm: 'size-icon-button-sm',
  md: 'size-icon-button',
  lg: 'size-icon-button-lg',
};

export interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  /** Required: every icon-only circle needs an accessible name. */
  label: string;
  tone?: IconTone;
  size?: IconSize;
  children: React.ReactNode;
}

/** A perfect circle with an icon inside — the only shape icon buttons take in Pulse. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = 'secondary', size = 'md', className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.9 }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-pill transition-colors',
        'disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-5',
        toneClass[tone],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
});
