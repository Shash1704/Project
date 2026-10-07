import { cn } from '@/lib/utils';

/** The small drag-handle notch at the top centre of every card and sheet. */
export function Notch({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute top-2.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-pill bg-ink/20',
        className,
      )}
    />
  );
}
