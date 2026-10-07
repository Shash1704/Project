import { z } from 'zod';

/** Crockford base32 ULID. Clients generate message IDs so optimistic UI and dedupe share one key. */
export const ulid = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'must be a ULID');

export const LANGS = ['en', 'hi', 'kn', 'ta'] as const;
export const lang = z.enum(LANGS);
export type Lang = z.infer<typeof lang>;

export const messageKind = z.enum(['text', 'image', 'file', 'voice', 'system']);
export type MessageKind = z.infer<typeof messageKind>;

export const MAX_BODY = 4000;

// ── Socket payloads (client → server) ──────────────────────────────────────

export const sendMessageInput = z
  .object({
    id: ulid,
    conversationId: ulid,
    kind: messageKind.exclude(['system']).default('text'),
    body: z.string().trim().max(MAX_BODY).optional(),
    replyToId: ulid.optional(),
    mediaId: ulid.optional(),
  })
  .refine((m) => (m.kind === 'text' ? !!m.body : !!m.mediaId), {
    message: 'text messages need a body; media messages need a mediaId',
  });
export type SendMessageInput = z.infer<typeof sendMessageInput>;

export const typingInput = z.object({ conversationId: ulid, typing: z.boolean() });

export const receiptInput = z.object({
  conversationId: ulid,
  /** Every message up to and including this ID is acknowledged. */
  upToId: ulid,
  status: z.enum(['delivered', 'read']),
});
export type ReceiptInput = z.infer<typeof receiptInput>;

export const joinInput = z.object({ conversationId: ulid });

// ── Kafka event values ─────────────────────────────────────────────────────

export const messageSentEvent = z.object({
  v: z.literal(1),
  id: ulid,
  conversationId: ulid,
  senderId: ulid,
  kind: messageKind,
  body: z.string().nullable(),
  replyToId: ulid.nullable(),
  mediaId: ulid.nullable(),
  createdAt: z.string(),
});
export type MessageSentEvent = z.infer<typeof messageSentEvent>;

export const receiptEvent = z.object({
  v: z.literal(1),
  conversationId: ulid,
  userId: ulid,
  upToId: ulid,
  status: z.enum(['delivered', 'read']),
  at: z.string(),
});
export type ReceiptEvent = z.infer<typeof receiptEvent>;

export const presenceEvent = z.object({
  v: z.literal(1),
  userId: ulid,
  state: z.enum(['online', 'offline']),
  at: z.string(),
});
export type PresenceEvent = z.infer<typeof presenceEvent>;

export const analyticsEvent = z.object({
  v: z.literal(1),
  type: z.enum(['message', 'reaction', 'ai_used', 'login']),
  conversationId: ulid.nullable(),
  userId: ulid,
  at: z.string(),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});
export type AnalyticsEvent = z.infer<typeof analyticsEvent>;

export const aiJobEvent = z.object({
  v: z.literal(1),
  type: z.enum(['embed', 'moments']),
  messageId: ulid,
  conversationId: ulid,
  at: z.string(),
});
export type AiJobEvent = z.infer<typeof aiJobEvent>;

// ── DTOs (server → client) ─────────────────────────────────────────────────

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read';

export interface UserDto {
  id: string;
  name: string;
  email?: string;
  avatarSeed: string;
  avatarUrl: string | null;
  about: string | null;
  lang: Lang;
  isDemo: boolean;
}

export interface MemberDto {
  userId: string;
  name: string;
  avatarSeed: string;
  avatarUrl: string | null;
  role: 'admin' | 'member';
}

export interface MediaDto {
  id: string;
  kind: 'image' | 'file' | 'voice';
  url: string;
  mime: string;
  bytes: number;
  name: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  kind: MessageKind;
  body: string | null;
  replyToId: string | null;
  media: MediaDto | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  status?: DeliveryStatus;
}

export interface ConversationDto {
  id: string;
  kind: 'direct' | 'group';
  title: string;
  avatarSeed: string;
  avatarUrl: string | null;
  members: MemberDto[];
  pinned: boolean;
  muted: boolean;
  aiEnabled: boolean;
  role: 'admin' | 'member';
  unread: number;
  lastMessage: MessageDto | null;
  lastMessageAt: string | null;
}

/** Socket.IO event map, shared by api and web for type-safe emit/on. */
export interface ServerToClient {
  'message:new': (m: MessageDto) => void;
  'message:ack': (a: { id: string; status: 'sent' } | { id: string; error: string }) => void;
  receipt: (r: {
    conversationId: string;
    userId: string;
    upToId: string;
    status: 'delivered' | 'read';
  }) => void;
  typing: (t: { conversationId: string; userId: string; typing: boolean }) => void;
  presence: (p: { userId: string; online: boolean; lastSeenAt: string | null }) => void;
  'conversation:updated': (c: { id: string }) => void;
}

export interface ClientToServer {
  'message:send': (m: SendMessageInput, ack?: (r: { ok: boolean; error?: string }) => void) => void;
  typing: (t: z.infer<typeof typingInput>) => void;
  receipt: (r: ReceiptInput) => void;
  'conversation:join': (j: z.infer<typeof joinInput>) => void;
}
