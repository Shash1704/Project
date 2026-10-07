'use client';

import { usePathname } from 'next/navigation';
import { ChatList } from '@/components/chat/chat-list';
import { ChatListSkeleton } from '@/components/chat/skeleton';
import { SessionGate } from '@/lib/session';
import { cn } from '@/lib/utils';

export function Splash() {
  return (
    <div className="min-h-dvh bg-ink px-screen pt-8" aria-busy="true">
      <p className="text-display text-white">
        My
        <br />
        Chats
      </p>
      <ChatListSkeleton />
    </div>
  );
}

/** Mobile: list or conversation. Desktop: 380px black list column + cream conversation pane. */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Any route other than the list itself takes over the screen on mobile.
  const inConversation = pathname !== '/';
  return (
    <SessionGate fallback={<Splash />}>
      <div className="bg-ink md:grid md:h-dvh md:grid-cols-[var(--pulse-size-desktop-list-width)_1fr] md:overflow-hidden">
        <ChatList className={cn('md:h-dvh md:min-h-0 md:overflow-y-auto', inConversation && 'hidden md:block')} />
        <main className={cn('min-w-0 md:overflow-hidden md:rounded-l-sheet', !inConversation && 'hidden md:block')}>{children}</main>
      </div>
    </SessionGate>
  );
}
