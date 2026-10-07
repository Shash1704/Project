import type { MediaDto, MessageDto, MessageSentEvent } from '@pulse/shared';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from './client';
import { MESSAGE_SELECT, toMessage, type MessageRow } from './rows';

/**
 * Persist a message from the `messages.sent` stream. Idempotent: Kafka delivers at least once and the
 * message ID is the primary key, so a redelivery is a no-op. Returns true if this call inserted it.
 */
export async function persistMessage(e: MessageSentEvent): Promise<boolean> {
  const createdAt = new Date(e.createdAt);
  const [res] = await db().query<ResultSetHeader>(
    `INSERT IGNORE INTO messages (id, conversation_id, sender_id, kind, body, reply_to_id, media_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.id, e.conversationId, e.senderId, e.kind, e.body, e.replyToId, e.mediaId, createdAt],
  );
  // Advance the conversation's pointer only forwards, so out-of-order redelivery can't rewind it.
  await db().query(
    `UPDATE conversations SET last_message_id = ?, last_message_at = ?
     WHERE id = ? AND (last_message_id IS NULL OR last_message_id < ?)`,
    [e.id, createdAt, e.conversationId, e.id],
  );
  return res.affectedRows > 0;
}

export async function getMessage(id: string): Promise<MessageDto | null> {
  const [rows] = await db().query<MessageRow[]>(`${MESSAGE_SELECT} WHERE m.id = ?`, [id]);
  return rows[0] ? toMessage(rows[0]) : null;
}

export async function getMessages(ids: string[]): Promise<MessageDto[]> {
  if (!ids.length) return [];
  const [rows] = await db().query<MessageRow[]>(`${MESSAGE_SELECT} WHERE m.id IN (?)`, [ids]);
  return rows.map(toMessage);
}

/** Newest-first page before `beforeId`, returned oldest-first for rendering. */
export async function listMessages(
  conversationId: string,
  opts: { beforeId?: string; limit?: number } = {},
): Promise<MessageDto[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const [rows] = opts.beforeId
    ? await db().query<MessageRow[]>(
        `${MESSAGE_SELECT} WHERE m.conversation_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT ?`,
        [conversationId, opts.beforeId, limit],
      )
    : await db().query<MessageRow[]>(
        `${MESSAGE_SELECT} WHERE m.conversation_id = ? ORDER BY m.id DESC LIMIT ?`,
        [conversationId, limit],
      );
  return rows.map(toMessage).reverse();
}

/** Everything after `afterId` (reconnect catch-up), oldest-first. */
export async function listMessagesAfter(
  conversationId: string,
  afterId: string,
  limit = 500,
): Promise<MessageDto[]> {
  const [rows] = await db().query<MessageRow[]>(
    `${MESSAGE_SELECT} WHERE m.conversation_id = ? AND m.id > ? ORDER BY m.id ASC LIMIT ?`,
    [conversationId, afterId, limit],
  );
  return rows.map(toMessage);
}

/** Record delivered/read for every message up to `upToId` not sent by `userId`. Idempotent. */
export async function recordReceipts(
  conversationId: string,
  userId: string,
  upToId: string,
  status: 'delivered' | 'read',
  at: Date,
): Promise<void> {
  const readCol = status === 'read' ? '?' : 'NULL';
  await db().query(
    `INSERT INTO message_receipts (message_id, user_id, delivered_at, read_at)
     SELECT m.id, ?, ?, ${readCol} FROM messages m
     WHERE m.conversation_id = ? AND m.id <= ? AND m.sender_id <> ?
     ON DUPLICATE KEY UPDATE
       delivered_at = COALESCE(delivered_at, VALUES(delivered_at)),
       read_at = COALESCE(read_at, VALUES(read_at))`,
    status === 'read'
      ? [userId, at, at, conversationId, upToId, userId]
      : [userId, at, conversationId, upToId, userId],
  );
}

/**
 * Tick state for a sender's messages from member watermarks: a message is delivered/read once
 * *every* other member's watermark has reached it.
 */
export function tickFor(
  messageId: string,
  senderId: string,
  marks: { userId: string; delivered: string | null; read: string | null }[],
): 'sent' | 'delivered' | 'read' {
  const others = marks.filter((w) => w.userId !== senderId);
  if (!others.length) return 'sent';
  if (others.every((w) => w.read !== null && w.read >= messageId)) return 'read';
  if (
    others.every(
      (w) =>
        (w.delivered !== null && w.delivered >= messageId) ||
        (w.read !== null && w.read >= messageId),
    )
  )
    return 'delivered';
  return 'sent';
}

export async function countMessages(): Promise<number> {
  const [rows] = await db().query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM messages');
  return Number(rows[0]?.n ?? 0);
}

interface MediaRow extends RowDataPacket {
  id: string;
  kind: MediaDto['kind'];
  url: string;
  mime: string;
  bytes: number;
  name: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
}

/** Media rows are written at upload time, before the message referencing them is sent. */
export async function getMedia(id: string): Promise<MediaDto | null> {
  const [rows] = await db().query<MediaRow[]>('SELECT * FROM media WHERE id = ?', [id]);
  const r = rows[0];
  return r
    ? {
        id: r.id,
        kind: r.kind,
        url: r.url,
        mime: r.mime,
        bytes: r.bytes,
        name: r.name,
        width: r.width,
        height: r.height,
        durationMs: r.duration_ms,
      }
    : null;
}

export async function insertMedia(
  m: Omit<MediaDto, 'id'> & { id: string; uploaderId: string },
): Promise<void> {
  await db().query(
    `INSERT INTO media (id, uploader_id, kind, url, mime, bytes, name, width, height, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [m.id, m.uploaderId, m.kind, m.url, m.mime, m.bytes, m.name, m.width, m.height, m.durationMs],
  );
}
