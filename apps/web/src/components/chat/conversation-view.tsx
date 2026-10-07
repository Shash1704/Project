'use client';

import type { ConversationDto } from '@pulse/shared';
import { AnimatePresence } from 'framer-motion';
import { AlertCircle, MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AiChip,
  AiTray,
  AvatarStack,
  Bubble,
  Composer,
  ConversationTitle,
  ConversationTopBar,
  IconButton,
  TypingIndicator,
  type ComposerTool,
} from '@/components/ds';
import { dayLabel, formatTime, lastSeen } from '@/lib/format';
import { useMe } from '@/lib/session';
import { CatchUpSheet } from './catch-up-sheet';
import {
  closeConversation,
  loadOlder,
  openConversation,
  patchMembership,
  retryMessage,
  sendMessage,
  signalTyping,
  statusOf,
  useChat,
  type LocalMessage,
} from '@/lib/store';

function Subtitle({ c }: { c: ConversationDto }) {
  const me = useMe();
  const presence = useChat((s) => s.presence);
  const typing = useChat((s) => s.typing[c.id]);
  const typers = Object.keys(typing ?? {})
    .filter((u) => u !== me?.id)
    .map((u) => c.members.find((m) => m.userId === u)?.name.split(' ')[0])
    .filter(Boolean);
  if (typers.length) return <span>{typers.join(', ')} typing…</span>;
  if (c.kind === 'direct') {
    const other = c.members.find((m) => m.userId !== me?.id);
    const p = other && presence[other.userId];
    return <span>{p?.online ? 'online' : lastSeen(p?.lastSeenAt ?? null)}</span>;
  }
  const online = c.members.filter((m) => m.userId !== me?.id && presence[m.userId]?.online).map((m) => m.name.split(' ')[0]);
  return (
    <span>
      {c.members.length} members{online.length ? ` · ${online.slice(0, 3).join(', ')} online` : ''}
    </span>
  );
}

export function ConversationView({ id }: { id: string }) {
  const router = useRouter();
  const me = useMe();
  const conv = useChat((s) => s.conversations[id]);
  const listLoaded = useChat((s) => s.listLoaded);
  const messages = useChat((s) => s.messages[id]);
  const hasMore = useChat((s) => s.hasMore[id]);
  const typing = useChat((s) => s.typing[id]);
  const state = useChat((s) => s);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const [tool, setTool] = useState<ComposerTool | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stickToBottom = useRef(true);
  const [catchUp, setCatchUp] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  // Unread count at the moment the chat was opened (opening clears it).
  const [unreadAtOpen] = useState(() => conv?.unread ?? 0);

  const jumpTo = (messageId: string) => {
    const el = scrollRef.current?.querySelector(`[data-mid="${messageId}"]`);
    if (!el) return;
    stickToBottom.current = false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlash(messageId);
    setTimeout(() => setFlash((f) => (f === messageId ? null : f)), 1600);
  };

  useEffect(() => {
    openConversation(id).catch(() => setError('This chat could not be loaded.'));
    return () => closeConversation();
  }, [id]);

  // Keep pinned to the newest message unless the reader has scrolled up.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages?.length, typing]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (el.scrollTop < 200 && hasMore) {
      const before = el.scrollHeight;
      void loadOlder(id).then(() => requestAnimationFrame(() => (el.scrollTop += el.scrollHeight - before)));
    }
  };

  const typers = useMemo(() => {
    return Object.keys(typing ?? {})
      .filter((u) => u !== me?.id)
      .map((u) => conv?.members.find((m) => m.userId === u))
      .filter((m): m is NonNullable<typeof m> => !!m);
  }, [typing, conv, me?.id]);

  if (!conv) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-cream px-screen text-center text-ink">
        {listLoaded ? (
          <>
            <p className="text-title">Chat not found</p>
            <button type="button" onClick={() => router.push('/')} className="min-h-11 rounded-pill bg-ink px-5 text-cream">
              Back to chats
            </button>
          </>
        ) : (
          <div className="h-10 w-48 animate-pulse rounded-pill bg-cream-deep" aria-label="Loading chat" role="status" />
        )}
      </div>
    );
  }

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    stickToBottom.current = true;
    sendMessage(id, { kind: 'text', body });
    setDraft('');
  };

  const nameOf = (uid: string) => conv.members.find((m) => m.userId === uid)?.name ?? 'Former member';

  return (
    <div className="flex h-dvh flex-col bg-cream text-ink">
      <ConversationTopBar
        title={conv.title}
        scrollRef={scrollRef}
        onBack={() => router.push('/')}
        right={
          <>
            <AvatarStack
              people={conv.members.filter((m) => m.userId !== me?.id).map((m) => ({ seed: m.avatarSeed, name: m.name, src: m.avatarUrl }))}
              size={40}
              max={3}
            />
            <IconButton label="Chat info" tone="primary" className="-ml-3 ring-[3px] ring-cream">
              <MoreHorizontal />
            </IconButton>
          </>
        }
      />

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-screen" aria-live="polite">
        <ConversationTitle title={conv.title} subtitle={<Subtitle c={conv} />} layoutId={`title-${conv.id}`} />
        {conv.aiEnabled && conv.kind === 'group' && (messages?.length ?? 0) >= 10 && (
          <div className="mb-4 flex justify-center">
            <AiChip onClick={() => setCatchUp(true)}>{unreadAtOpen >= 5 ? `Catch me up · ${unreadAtOpen} new` : 'Catch me up'}</AiChip>
          </div>
        )}
        {error && (
          <p role="alert" className="mb-4 rounded-pill bg-coral px-4 py-2 text-body">
            {error}
          </p>
        )}
        {!messages ? (
          <div className="flex flex-col gap-2" role="status" aria-label="Loading messages">
            {[60, 40, 70, 50].map((w, i) => (
              <div key={i} className={`h-12 animate-pulse rounded-bubble bg-cream-deep ${i % 2 ? 'self-end' : ''}`} style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="mt-6 rounded-card bg-cream-deep p-6">
            <p className="text-title">Say hi 👋</p>
            <p className="mt-1 text-body text-muted">Messages here are delivered through Kafka in real time.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-4">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
              const mine = m.senderId === me?.id;
              const showAuthor = conv.kind === 'group' && !mine && (newDay || prev?.senderId !== m.senderId);
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <p className="my-2 self-center rounded-pill bg-cream-deep px-3 py-1 text-caption text-muted">{dayLabel(m.createdAt)}</p>
                  )}
                  <MessageRow
                    m={m}
                    mine={mine}
                    author={showAuthor ? nameOf(m.senderId) : undefined}
                    status={statusOf(m, state)}
                    flash={flash === m.id}
                  />
                </Fragment>
              );
            })}
            <AnimatePresence>
              {typers.map((t) => (
                <TypingIndicator key={t.userId} name={t.name} seed={t.avatarSeed} src={t.avatarUrl} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="shrink-0 px-screen">
        <AiTray
          open={tool === 'replies' || tool === 'tone'}
          onClose={() => setTool(null)}
          aiEnabled={conv.aiEnabled}
          onToggleAi={() => void patchMembership(conv.id, { aiEnabled: !conv.aiEnabled })}
        >
          <p className="px-1 text-body text-white/80">
            {conv.aiEnabled
              ? 'AI is on for this chat: Catch me up reads only this conversation, and only for you.'
              : 'AI is off for this chat. Tap the dot to opt in — nothing is sent to the AI until you do.'}
          </p>
        </AiTray>
      </div>
      <CatchUpSheet conversationId={conv.id} open={catchUp} onClose={() => setCatchUp(false)} onJump={jumpTo} />
      <Composer
        value={draft}
        onChange={setDraft}
        onTyping={() => signalTyping(id)}
        onSend={send}
        activeTool={tool}
        onTool={(t) => setTool((cur) => (cur === t ? null : t))}
      />
    </div>
  );
}

function MessageRow({
  m,
  mine,
  author,
  status,
  flash,
}: {
  m: LocalMessage;
  mine: boolean;
  author?: string;
  status: ReturnType<typeof statusOf>;
  flash?: boolean;
}) {
  const failed = status === 'failed';
  return (
    <div data-mid={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <Bubble
        flash={flash}
        outgoing={mine}
        author={author}
        time={formatTime(m.createdAt)}
        status={failed ? undefined : status}
        edited={!!m.editedAt}
      >
        {m.deletedAt ? (
          <em className="opacity-70">This message was deleted</em>
        ) : m.kind === 'image' && m.media ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote user media, sized by its own metadata
          <img
            src={m.media.url}
            alt="Shared photo"
            width={m.media.width ?? 300}
            height={m.media.height ?? 400}
            className="max-h-80 w-auto rounded-[calc(var(--pulse-radius-bubble)-8px)] object-cover"
            loading="lazy"
          />
        ) : (
          m.body
        )}
      </Bubble>
      {failed && (
        <button
          type="button"
          onClick={() => retryMessage(m.conversationId, m.id)}
          className="mt-1 flex min-h-11 items-center gap-1.5 rounded-pill px-3 text-caption text-ink"
        >
          <AlertCircle className="size-4" /> Not sent · tap to retry
        </button>
      )}
    </div>
  );
}
