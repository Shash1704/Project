'use client';

import { cn } from '@/lib/utils';

/** Outline filter pill for hub (black) screens. */
export function FilterPill({
  active,
  children,
  onClick,
  count,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center gap-1 rounded-pill border-2 px-4 text-body transition-colors',
        active ? 'border-white text-white' : 'border-white/25 text-white/55 hover:text-white/80',
      )}
    >
      {children}
      {count !== undefined && <span className="tabular-nums">({count})</span>}
    </button>
  );
}

/** A `cream-deep` row on cream content screens — decisions, deadlines, settings rows. */
export function RowPill({
  children,
  icon,
  onClick,
  className,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex min-h-11 w-full items-center gap-3 rounded-pill bg-cream-deep px-4 py-2.5 text-left text-body text-ink',
        onClick && 'transition-transform active:scale-[0.98]',
        className,
      )}
    >
      {icon && <span className="shrink-0 [&_svg]:size-4">{icon}</span>}
      <span className="min-w-0 flex-1">{children}</span>
    </Comp>
  );
}

/** The mustard AI chip (AI accent is reserved for AI surfaces). */
export function AiChip({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-highlight px-4 text-body font-semibold text-ink transition-transform active:scale-95"
    >
      <span aria-hidden className="size-2.5 rounded-pill bg-ink" />
      {children}
    </button>
  );
}
