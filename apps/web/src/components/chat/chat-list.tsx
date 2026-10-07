'use client';

import type { ConversationDto } from '@pulse/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { Gauge, LogOut, Menu, MessageCirclePlus, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { cardColorFor } from '@pulse/ui';
import { ChatCard, Fab, FilterPill, IconButton, type ChatCardProps } from '@/components/ds';
import { logout } from '@/lib/api';
import { formatWhen } from '@/lib/format';
import { useMe } from '@/lib/session';
import { useChat } from '@/lib/store';
import { cn } from '@/lib/utils';
import { NewChatSheet } from './new-chat-sheet';
import { ChatListSkeleton } from './skeleton';

type Filter = 'all' | 'unread' | 'groups' | 'ai';

function preview(c: ConversationDto, meId: string | undefined): string {
  const m = c.lastMessage;
  if (!m) return c.kind === 'group' ? 'Say hello to the group 👋' : 'Start the conversation';
  const who = m.senderId === meId ? 'You' : c.kind === 'group' ? (c.members.find((x) => x.userId === m.senderId)?.name.split(' ')[0] ?? '') : '';
  const body =
    m.deletedAt ? 'Message deleted' : m.kind === 'image' ? '📷 Photo' : m.kind === 'voice' ? '🎤 Voice note' : m.kind === 'file' ? `📄 ${m.media?.name ?? 'Document'}` : (m.body ?? '');
  return who ? `${who}: ${body}` : body;
}

/** Map a conversation onto a bento card variant. */
export function toCard(c: ConversationDto, meId: string | undefined, onOpen: () => void): ChatCardProps {
  const base = { id: c.id, name: c.title, color: cardColorFor(c.id), unread: c.unread, muted: c.muted, onOpen, layoutId: `card-${c.id}` };
  const m = c.lastMessage;
  if (c.pinned && c.kind === 'direct') return { ...base, variant: 'pinned', avatarSeed: c.avatarSeed, avatarSrc: c.avatarUrl };
  if (m?.kind === 'image' && m.media && !m.deletedAt)
    return { ...base, variant: 'media', imageUrl: m.media.url, imageAlt: `Latest photo in ${c.title}` };
  if (m?.kind === 'voice' && !m.deletedAt) {
    const secs = Math.round((m.media?.durationMs ?? 0) / 1000);
    return { ...base, variant: 'voice', caption: `Voice note · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` };
  }
  return { ...base, variant: 'text', preview: preview(c, meId), time: formatWhen(c.lastMessageAt) };
}

export function ChatList({ className }: { className?: string }) {
  const router = useRouter();
  const me = useMe();
  const conversations = useChat((s) => s.conversations);
  const loaded = useChat((s) => s.listLoaded);
  const active = useChat((s) => s.active);
  const [filter, setFilter] = useState<Filter>('all');
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<null | 'direct' | 'group'>(null);
  const [accountMenu, setAccountMenu] = useState(false);

  const all = useMemo(
    () =>
      Object.values(conversations).sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) || (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '') || b.id.localeCompare(a.id),
      ),
    [conversations],
  );
  const shown = all.filter((c) =>
    filter === 'unread' ? c.unread > 0 : filter === 'groups' ? c.kind === 'group' : filter === 'ai' ? c.aiEnabled : true,
  );

  return (
    <section aria-label="Chats" className={cn('relative min-h-dvh bg-ink px-screen pt-8 pb-28 text-white', className)}>
      <div className="flex items-start justify-between">
        <h1 className="text-display md:text-display-desktop">
          My
          <br />
          Chats
        </h1>
        <div className="relative">
          <IconButton label="Account menu" tone="hub" aria-expanded={accountMenu} onClick={() => setAccountMenu((v) => !v)}>
            <Menu />
          </IconButton>
          <AnimatePresence>
            {accountMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -6 }}
                className="absolute top-14 right-0 z-20 w-56 origin-top-right rounded-card bg-cream p-2 text-ink"
              >
                <p className="px-3 pt-2 pb-1 text-caption text-muted">Signed in as</p>
                <p className="truncate px-3 pb-2 text-card-title">{me?.name}</p>
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenu(false);
                    router.push('/under-the-hood');
                  }}
                  className="mb-2 flex min-h-11 w-full items-center gap-2 rounded-pill bg-cream-deep px-4 text-body"
                >
                  <Gauge className="size-4" /> Under the hood
                </button>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="flex min-h-11 w-full items-center gap-2 rounded-pill bg-cream-deep px-4 text-body"
                >
                  <LogOut className="size-4" /> Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="-mx-screen mt-6 flex gap-2 overflow-x-auto px-screen pb-1 [scrollbar-width:none]" role="toolbar" aria-label="Filter chats">
        <FilterPill active={filter === 'all'} count={all.length} onClick={() => setFilter('all')}>
          All
        </FilterPill>
        <FilterPill active={filter === 'unread'} onClick={() => setFilter('unread')}>
          Unread
        </FilterPill>
        <FilterPill active={filter === 'groups'} onClick={() => setFilter('groups')}>
          Groups
        </FilterPill>
        <FilterPill active={filter === 'ai'} onClick={() => setFilter('ai')}>
          AI Picks
        </FilterPill>
      </div>

      {!loaded ? (
        <ChatListSkeleton />
      ) : shown.length === 0 ? (
        <EmptyState filter={filter} onNew={() => setSheet('direct')} />
      ) : (
        <motion.div layout className="mt-5 grid grid-cols-2 gap-gap [grid-auto-flow:dense]">
          {shown.map((c) => (
            <div key={c.id} className={cn('contents', active === c.id && '[&>*]:ring-4 [&>*]:ring-white')}>
              <ChatCard {...toCard(c, me?.id, () => router.push(`/c/${c.id}`))} />
            </div>
          ))}
        </motion.div>
      )}

      <div className="pointer-events-none fixed right-0 bottom-6 left-0 z-30 flex justify-end px-screen md:absolute md:w-full">
        <div className="pointer-events-auto relative">
          <AnimatePresence>
            {menu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 bottom-20 flex w-52 flex-col gap-2"
              >
                <MenuPill icon={<MessageCirclePlus />} onClick={() => { setMenu(false); setSheet('direct'); }}>
                  New chat
                </MenuPill>
                <MenuPill icon={<Users />} onClick={() => { setMenu(false); setSheet('group'); }}>
                  New group
                </MenuPill>
              </motion.div>
            )}
          </AnimatePresence>
          <Fab open={menu} onClick={() => setMenu((v) => !v)} label={menu ? 'Close menu' : 'New chat'} />
        </div>
      </div>

      <NewChatSheet mode={sheet} onClose={() => setSheet(null)} />
    </section>
  );
}

function MenuPill({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 items-center gap-3 rounded-pill bg-cream px-5 text-card-title text-ink [&_svg]:size-5"
    >
      {icon}
      {children}
    </button>
  );
}

function EmptyState({ filter, onNew }: { filter: Filter; onNew: () => void }) {
  const copy = {
    all: ['No chats yet', 'Start one with a friend — or a judge.'],
    unread: ['All caught up', 'Nothing unread right now.'],
    groups: ['No groups yet', 'Bring a few people together.'],
    ai: ['No AI picks yet', 'Turn on AI in a chat to see it here.'],
  }[filter];
  return (
    <div className="mt-5 rounded-card bg-ink-raised p-6">
      <p className="text-title">{copy[0]}</p>
      <p className="mt-2 text-body text-white/70">{copy[1]}</p>
      {filter === 'all' && (
        <button type="button" onClick={onNew} className="mt-5 min-h-11 rounded-pill bg-cream px-5 text-card-title text-ink">
          Start a chat
        </button>
      )}
    </div>
  );
}
