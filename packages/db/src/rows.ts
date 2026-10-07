import type { Lang, MediaDto, MessageDto, MessageKind, UserDto } from '@pulse/shared';
import type { RowDataPacket } from 'mysql2';

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  name: string;
  avatar_seed: string;
  avatar_url: string | null;
  about: string | null;
  lang: string;
  is_demo: number;
  last_seen_at: Date | null;
}

export const toUser = (r: UserRow, withEmail = false): UserDto => ({
  id: r.id,
  name: r.name,
  ...(withEmail ? { email: r.email } : {}),
  avatarSeed: r.avatar_seed,
  avatarUrl: r.avatar_url,
  about: r.about,
  lang: r.lang as Lang,
  isDemo: !!r.is_demo,
});

export interface MessageRow extends RowDataPacket {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: MessageKind;
  body: string | null;
  reply_to_id: string | null;
  media_id: string | null;
  created_at: Date;
  edited_at: Date | null;
  deleted_at: Date | null;
  // joined media columns (nullable)
  m_kind: MediaDto['kind'] | null;
  m_url: string | null;
  m_mime: string | null;
  m_bytes: number | null;
  m_name: string | null;
  m_width: number | null;
  m_height: number | null;
  m_duration_ms: number | null;
}

export const MESSAGE_SELECT = `
  SELECT m.id, m.conversation_id, m.sender_id, m.kind, m.body, m.reply_to_id, m.media_id,
         m.created_at, m.edited_at, m.deleted_at,
         md.kind AS m_kind, md.url AS m_url, md.mime AS m_mime, md.bytes AS m_bytes, md.name AS m_name,
         md.width AS m_width, md.height AS m_height, md.duration_ms AS m_duration_ms
  FROM messages m
  LEFT JOIN media md ON md.id = m.media_id`;

export const toMessage = (r: MessageRow): MessageDto => ({
  id: r.id,
  conversationId: r.conversation_id,
  senderId: r.sender_id,
  kind: r.kind,
  body: r.deleted_at ? null : r.body,
  replyToId: r.reply_to_id,
  media:
    r.media_id && r.m_url && !r.deleted_at
      ? {
          id: r.media_id,
          kind: r.m_kind!,
          url: r.m_url,
          mime: r.m_mime!,
          bytes: r.m_bytes!,
          name: r.m_name,
          width: r.m_width,
          height: r.m_height,
          durationMs: r.m_duration_ms,
        }
      : null,
  createdAt: r.created_at.toISOString(),
  editedAt: iso(r.edited_at),
  deletedAt: iso(r.deleted_at),
});
