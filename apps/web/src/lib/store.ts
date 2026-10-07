'use client';

import {
  tickFor,
  type ConversationDto,
  type DeliveryStatus,
  type MessageDto,
  type SendMessageInput,
  type UserDto,
} from '@pulse/shared';
import { useSyncExternalStore } from 'react';
import { ulid } from 'ulid';
import { api } from './api';
import { getSocket } from './socket';

export interface Watermark {
  userId: string;
  delivered: string | null;
  read: string | null;
}

export interface LocalMessage extends MessageDto {
  /** Client-only state for optimistic sends. */
  local?: 'pending' | 'failed';
}

export interface ChatState {
  me: UserDto | null;
  conversations: Record<string, ConversationDto>;
  listLoaded: boolean;
  messages: Record<string, LocalMessage[]>;
  hasMore: Record<string, boolean>;
  marks: Record<string, Watermark[]>;
  /** conv → user → typing (entries expire on their own after 6s of silence). */
  typing: Record<string, Record<string, true>>;
  presence: Record<string, { online: boolean; lastSeenAt: string | null }>;
  active: string | null;
  connection: 'idle' | 'connecting' | 'online' | 'offline';
}

const initial: ChatState = {
  me: null,
  conversations: {},
  listLoaded: false,
  messages: {},
  hasMore: {},
  marks: {},
  typing: {},
  presence: {},
  active: null,
  connection: 'idle',
};

let state: ChatState = initial;
const subs = new Set<() => void>();

function set(patch: Partial<ChatState> | ((s: ChatState) => Partial<ChatState>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subs.forEach((f) => f());
}

export const getState = () => state;

export function useChat<T>(selector: (s: ChatState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => selector(state),
    () => selector(initial),
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

/** Insert or merge by ID, keeping the list sorted (ULIDs sort by time). */
function upsertMessages(list: LocalMessage[] | undefined, incoming: LocalMessage[]): LocalMessage[] {
  const byId = new Map((list ?? []).map((m) => [m.id, m]));
  for (const m of incoming) {
    const prev = byId.get(m.id);
    // Server copy wins, but drop the local flag once the server has it.
    byId.set(m.id, prev ? { ...prev, ...m, local: m.local } : m);
  }
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function statusOf(m: LocalMessage, s: ChatState = state): DeliveryStatus | 'failed' {
  if (m.local === 'failed') return 'failed';
  if (m.local === 'pending') return 'pending';
  const marks = s.marks[m.conversationId];
  return marks ? tickFor(m.id, m.senderId, marks) : (m.status ?? 'sent');
}

const visible = () => typeof document !== 'undefined' && document.visibilityState === 'visible';

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

function setTyping(conversationId: string, userId: string, on: boolean) {
  const key = `${conversationId}:${userId}`;
  clearTimeout(typingTimers.get(key));
  typingTimers.delete(key);
  if (on) typingTimers.set(key, setTimeout(() => setTyping(conversationId, userId, false), 6_000));
  set((s) => {
    const conv = { ...(s.typing[conversationId] ?? {}) };
    if (on) conv[userId] = true;
    else delete conv[userId];
    return { typing: { ...s.typing, [conversationId]: conv } };
  });
}

// ── lifecycle ──────────────────────────────────────────────────────────────

let wired = false;

export async function startChat(me: UserDto): Promise<void> {
  set({ me });
  await loadConversations();
  const socket = getSocket();
  if (!wired) {
    wired = true;
    socket.on('connect', () => {
      const recovered = socket.recovered;
      set({ connection: 'online' });
      if (!recovered) void catchUp();
    });
    socket.on('disconnect', () => set({ connection: 'offline' }));
    socket.io.on('reconnect_attempt', () => set({ connection: 'connecting' }));
    socket.on('message:new', onMessage);
    socket.on('receipt', (r) => {
      set((s) => {
        const marks = (s.marks[r.conversationId] ?? []).map((w) => {
          if (w.userId !== r.userId) return w;
          const fwd = (cur: string | null) => (!cur || cur < r.upToId ? r.upToId : cur);
          return { ...w, delivered: fwd(w.delivered), read: r.status === 'read' ? fwd(w.read) : w.read };
        });
        return { marks: { ...s.marks, [r.conversationId]: marks } };
      });
    });
    socket.on('typing', (t) => setTyping(t.conversationId, t.userId, t.typing));
    socket.on('presence', (p) => set((s) => ({ presence: { ...s.presence, [p.userId]: p } })));
    socket.on('conversation:updated', ({ id }) => void refreshConversation(id));
    document.addEventListener('visibilitychange', () => {
      if (visible() && state.active) markRead(state.active);
    });
  }
  set({ connection: 'connecting' });
  socket.connect();
}

export function resetChat() {
  getSocket().disconnect();
  state = initial;
  subs.forEach((f) => f());
}

export async function loadConversations(): Promise<void> {
  const list = await api<ConversationDto[]>('/conversations');
  set({ conversations: Object.fromEntries(list.map((c) => [c.id, c])), listLoaded: true });
  // Everything that arrived while we were away is now delivered to this device.
  for (const c of list) {
    if (c.lastMessage && c.lastMessage.senderId !== state.me?.id) {
      getSocket().emit('receipt', { conversationId: c.id, upToId: c.lastMessage.id, status: 'delivered' });
    }
  }
}

async function refreshConversation(id: string) {
  try {
    const c = await api<ConversationDto>(`/conversations/${id}`);
    set((s) => ({ conversations: { ...s.conversations, [id]: c } }));
    getSocket().emit('conversation:join', { conversationId: id });
  } catch {
    // Removed from the conversation.
    set((s) => {
      const conversations = { ...s.conversations };
      delete conversations[id];
      return { conversations, active: s.active === id ? null : s.active };
    });
  }
}

/** After a reconnect that socket.io couldn't recover, fetch everything missed since our last known IDs. */
async function catchUp() {
  await loadConversations().catch(() => {});
  await Promise.all(
    Object.entries(state.messages).map(async ([convId, list]) => {
      const lastServer = [...list].reverse().find((m) => !m.local);
      if (!lastServer) return;
      const missed = await api<MessageDto[]>(`/conversations/${convId}/messages?after=${lastServer.id}`).catch(() => []);
      if (missed.length) set((s) => ({ messages: { ...s.messages, [convId]: upsertMessages(s.messages[convId], missed) } }));
      await loadMarks(convId);
    }),
  );
  // Resend anything that never got acknowledged.
  for (const list of Object.values(state.messages)) for (const m of list) if (m.local) resend(m);
}

function onMessage(m: MessageDto) {
  const me = state.me?.id;
  set((s) => {
    const conv = s.conversations[m.conversationId];
    const isActive = s.active === m.conversationId && visible();
    const conversations = conv
      ? {
          ...s.conversations,
          [m.conversationId]: {
            ...conv,
            lastMessage: m,
            lastMessageAt: m.createdAt,
            unread: m.senderId !== me && !isActive ? conv.unread + 1 : conv.unread,
          },
        }
      : s.conversations;
    const messages = s.messages[m.conversationId]
      ? { ...s.messages, [m.conversationId]: upsertMessages(s.messages[m.conversationId], [{ ...m, local: undefined }]) }
      : s.messages;
    return { conversations, messages };
  });
  setTyping(m.conversationId, m.senderId, false);
  if (!state.conversations[m.conversationId]) void refreshConversation(m.conversationId);
  if (m.senderId !== me) {
    const read = state.active === m.conversationId && visible();
    getSocket().emit('receipt', { conversationId: m.conversationId, upToId: m.id, status: read ? 'read' : 'delivered' });
  }
}

// ── conversation actions ───────────────────────────────────────────────────

async function loadMarks(convId: string) {
  const marks = await api<Watermark[]>(`/conversations/${convId}/receipts`).catch(() => null);
  if (marks) set((s) => ({ marks: { ...s.marks, [convId]: marks } }));
}

export async function openConversation(id: string): Promise<void> {
  set({ active: id });
  if (!state.messages[id]) {
    const page = await api<MessageDto[]>(`/conversations/${id}/messages?limit=50`);
    set((s) => ({ messages: { ...s.messages, [id]: upsertMessages(s.messages[id], page) }, hasMore: { ...s.hasMore, [id]: page.length === 50 } }));
  }
  await loadMarks(id);
  markRead(id);
}

export function closeConversation() {
  set({ active: null });
}

export function markRead(id: string) {
  const list = state.messages[id];
  const lastOther = list && [...list].reverse().find((m) => m.senderId !== state.me?.id && !m.local);
  if (lastOther) getSocket().emit('receipt', { conversationId: id, upToId: lastOther.id, status: 'read' });
  set((s) => (s.conversations[id] ? { conversations: { ...s.conversations, [id]: { ...s.conversations[id]!, unread: 0 } } } : {}));
  void api(`/conversations/${id}/read`, { method: 'POST' }).catch(() => {});
}

export async function loadOlder(id: string): Promise<void> {
  const first = state.messages[id]?.find((m) => !m.local);
  if (!first || state.hasMore[id] === false) return;
  const page = await api<MessageDto[]>(`/conversations/${id}/messages?before=${first.id}&limit=50`);
  set((s) => ({ messages: { ...s.messages, [id]: upsertMessages(s.messages[id], page) }, hasMore: { ...s.hasMore, [id]: page.length === 50 } }));
}

function emitSend(input: SendMessageInput) {
  void getSocket()
    .timeout(10_000)
    .emitWithAck('message:send', input)
    .then((res) => res.ok)
    .catch(() => false)
    .then((ok) => {
      set((s) => ({
        messages: {
          ...s.messages,
          [input.conversationId]: (s.messages[input.conversationId] ?? []).map((m) =>
            // Only touch it while still local: the server echo may have confirmed it before a late/failed ack.
            m.id === input.id && m.local ? { ...m, local: ok ? undefined : 'failed', status: ok ? 'sent' : m.status } : m,
          ),
        },
      }));
    });
}

/** Optimistic send: the bubble appears instantly with a pending tick, then reconciles on ack. */
export function sendMessage(conversationId: string, input: Omit<SendMessageInput, 'id' | 'conversationId'>): string {
  const me = state.me!;
  const id = ulid();
  const optimistic: LocalMessage = {
    id,
    conversationId,
    senderId: me.id,
    kind: input.kind ?? 'text',
    body: input.body ?? null,
    replyToId: input.replyToId ?? null,
    media: null,
    createdAt: new Date().toISOString(),
    editedAt: null,
    deletedAt: null,
    local: 'pending',
  };
  set((s) => {
    const conv = s.conversations[conversationId];
    return {
      messages: { ...s.messages, [conversationId]: upsertMessages(s.messages[conversationId], [optimistic]) },
      conversations: conv
        ? { ...s.conversations, [conversationId]: { ...conv, lastMessage: optimistic, lastMessageAt: optimistic.createdAt } }
        : s.conversations,
    };
  });
  emitSend({ ...input, kind: input.kind ?? 'text', id, conversationId });
  return id;
}

function resend(m: LocalMessage) {
  set((s) => ({
    messages: {
      ...s.messages,
      [m.conversationId]: (s.messages[m.conversationId] ?? []).map((x) => (x.id === m.id ? { ...x, local: 'pending' } : x)),
    },
  }));
  emitSend({
    id: m.id,
    conversationId: m.conversationId,
    kind: m.kind === 'system' ? 'text' : m.kind,
    body: m.body ?? undefined,
    replyToId: m.replyToId ?? undefined,
    mediaId: m.media?.id,
  });
}

export function retryMessage(conversationId: string, id: string) {
  const m = state.messages[conversationId]?.find((x) => x.id === id);
  if (m) resend(m);
}

let typingTimer: ReturnType<typeof setTimeout> | undefined;
let typingSentAt = 0;

/** Throttled typing signal (at most every 3s), auto-cleared after 4s idle. */
export function signalTyping(conversationId: string) {
  const now = Date.now();
  if (now - typingSentAt > 3_000) {
    typingSentAt = now;
    getSocket().emit('typing', { conversationId, typing: true });
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    typingSentAt = 0;
    getSocket().emit('typing', { conversationId, typing: false });
  }, 4_000);
}

export async function patchMembership(id: string, flags: { pinned?: boolean; muted?: boolean; aiEnabled?: boolean }) {
  const c = await api<ConversationDto>(`/conversations/${id}/me`, { method: 'PATCH', json: flags });
  set((s) => ({ conversations: { ...s.conversations, [id]: c } }));
}

export function upsertConversation(c: ConversationDto) {
  set((s) => ({ conversations: { ...s.conversations, [c.id]: c } }));
  getSocket().emit('conversation:join', { conversationId: c.id });
}
