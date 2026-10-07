'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Round checkbox row. The whole row is the 44px touch target. */
export function RoundCheckbox({
  checked,
  onChange,
  children,
  className,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked);
      }}
      className={cn('flex min-h-11 w-full items-center gap-2.5 text-left', className)}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-pill border-2 border-ink transition-colors',
          checked && 'bg-ink text-white',
        )}
      >
        {checked && <Check strokeWidth={3} className="size-3" />}
      </span>
      <span className={cn('text-caption line-clamp-2', checked && 'line-through opacity-70')}>
        {children}
      </span>
    </button>
  );
}
