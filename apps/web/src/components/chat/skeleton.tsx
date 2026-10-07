import { cn } from '@/lib/utils';

/** Skeleton blocks — Pulse never shows spinners. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-card bg-white/10', className)} />;
}

export function ChatListSkeleton() {
  return (
    <div className="mt-5 grid grid-cols-2 gap-gap" role="status" aria-label="Loading chats">
      <Skeleton className="aspect-square" />
      <Skeleton className="row-span-2" />
      <Skeleton className="aspect-square" />
      <Skeleton className="col-span-2 h-[72px] rounded-pill" />
      <Skeleton className="aspect-square" />
      <Skeleton className="aspect-square" />
    </div>
  );
}
