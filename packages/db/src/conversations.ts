import type { ConversationDto, MemberDto, MessageDto } from '@pulse/shared';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { db } from './client';
import { newId } from './ids';
import { MESSAGE_SELECT, toMessage, type MessageRow } from './rows';

interface ConvRow extends RowDataPacket {
  id: string;
  kind: 'direct' | 'group';
  title: string | null;
  avatar_url: string | null;
  last_message_id: string | null;
  last_message_at: Date | null;
  role: 'admin' | 'member';
  pinned: number;
  muted: number;
  ai_enabled: number;
  last_read_message_id: string | null;
}

interface MemberRow extends RowDataPacket {
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  name: string;
  avatar_seed: string;
  avatar_url: string | null;
}

export const directKey = (a: string, b: string) => [a, b].sort().join(':');

async function membersFor(ids: string[]): Promise<Map<string, MemberDto[]>> {
  const out = new Map<string, MemberDto[]>();
  if (!ids.length) return out;
  const [rows] = await db().query<MemberRow[]>(
    `SELECT cm.conversation_id, cm.user_id, cm.role, u.name, u.avatar_seed, u.avatar_url
     FROM conversation_members cm JOIN users u ON u.id = cm.user_id
     WHERE cm.conversation_id IN (?) ORDER BY cm.joined_at`,
    [ids],
  );
  for (const r of rows) {
    const list = out.get(r.conversation_id) ?? [];
    list.push({
      userId: r.user_id,
      name: r.name,
      avatarSeed: r.avatar_seed,
      avatarUrl: r.avatar_url,
      role: r.role,
    });
    out.set(r.conversation_id, list);
  }
  return out;
}

async function lastMessages(ids: string[]): Promise<Map<string, MessageDto>> {
  const out = new Map<string, MessageDto>();
  if (!ids.length) return out;
  const [rows] = await db().query<MessageRow[]>(`${MESSAGE_SELECT} WHERE m.id IN (?)`, [ids]);
  for (const r of rows) out.set(r.conversation_id, toMessage(r));
  return out;
}

function shape(
  r: ConvRow,
  viewerId: string,
  members: MemberDto[],
  last: MessageDto | null,
  unread: number,
): ConversationDto {
  const other = r.kind === 'direct' ? members.find((m) => m.userId !== viewerId) : undefined;
  return {
    id: r.id,
    kind: r.kind,
    title: r.kind === 'direct' ? (other?.name ?? 'Chat') : (r.title ?? 'Group'),
    avatarSeed: other?.avatarSeed ?? r.id,
    avatarUrl: r.kind === 'direct' ? (other?.avatarUrl ?? null) : r.avatar_url,
    members,
    pinned: !!r.pinned,
    muted: !!r.muted,
    aiEnabled: !!r.ai_enabled,
    role: r.role,
    unread,
    lastMessage: last,
    lastMessageAt: r.last_message_at?.toISOString() ?? null,
  };
}

const CONV_SELECT = `
  SELECT c.id, c.kind, c.title, c.avatar_url, c.last_message_id, c.last_message_at,
         cm.role, cm.pinned, cm.muted, cm.ai_enabled, cm.last_read_message_id
  FROM conversation_members cm JOIN conversations c ON c.id = cm.conversation_id`;

/**
 * The viewer's conversations, latest first. `unread` comes from the caller (Valkey counters);
 * `unreadFromDb` rebuilds the same numbers from MySQL when the cache is cold.
 */
export async function listConversations(
  userId: string,
  unread: Record<string, number> = {},
): Promise<ConversationDto[]> {
  const [rows] = await db().query<ConvRow[]>(
    `${CONV_SELECT} WHERE cm.user_id = ? ORDER BY cm.pinned DESC, COALESCE(c.last_message_at, c.created_at) DESC`,
    [userId],
  );
  const ids = rows.map((r) => r.id);
  const [members, last] = await Promise.all([
    membersFor(ids),
    lastMessages(rows.map((r) => r.last_message_id).filter((x): x is string => !!x)),
  ]);
  return rows.map((r) =>
    shape(r, userId, members.get(r.id) ?? [], last.get(r.id) ?? null, unread[r.id] ?? 0),
  );
}

export async function getConversation(
  id: string,
  userId: string,
  unread = 0,
): Promise<ConversationDto | null> {
  const [rows] = await db().query<ConvRow[]>(`${CONV_SELECT} WHERE c.id = ? AND cm.user_id = ?`, [
    id,
    userId,
  ]);
  const r = rows[0];
  if (!r) return null;
  const [members, last] = await Promise.all([
    membersFor([id]),
    lastMessages(r.last_message_id ? [r.last_message_id] : []),
  ]);
  return shape(r, userId, members.get(id) ?? [], last.get(id) ?? null, unread);
}

export async function memberIds(conversationId: string): Promise<string[]> {
  const [rows] = await db().query<RowDataPacket[]>(
    'SELECT user_id FROM conversation_members WHERE conversation_id = ?',
    [conversationId],
  );
  return rows.map((r) => r.user_id as string);
}

export async function conversationIdsFor(userId: string): Promise<string[]> {
  const [rows] = await db().query<RowDataPacket[]>(
    'SELECT conversation_id FROM conversation_members WHERE user_id = ?',
    [userId],
  );
  return rows.map((r) => r.conversation_id as string);
}

export async function membership(
  conversationId: string,
  userId: string,
): Promise<{ role: 'admin' | 'member'; aiEnabled: boolean } | null> {
  const [rows] = await db().query<RowDataPacket[]>(
    'SELECT role, ai_enabled FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
    [conversationId, userId],
  );
  const r = rows[0];
  return r ? { role: r.role, aiEnabled: !!r.ai_enabled } : null;
}

async function tx<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** Get-or-create the 1:1 conversation between two users (deduped by `direct_key`). */
export async function ensureDirect(a: string, b: string): Promise<string> {
  const key = directKey(a, b);
  const [existing] = await db().query<RowDataPacket[]>(
    'SELECT id FROM conversations WHERE direct_key = ?',
    [key],
  );
  if (existing[0]) return existing[0].id as string;
  const id = newId();
  return tx(async (c) => {
    await c.query(
      `INSERT INTO conversations (id, kind, direct_key, created_by) VALUES (?, 'direct', ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [id, key, a],
    );
    const [rows] = await c.query<RowDataPacket[]>(
      'SELECT id FROM conversations WHERE direct_key = ?',
      [key],
    );
    const convId = rows[0]!.id as string;
    await c.query(
      `INSERT IGNORE INTO conversation_members (conversation_id, user_id, role) VALUES (?, ?, 'admin'), (?, ?, 'admin')`,
      [convId, a, convId, b],
    );
    return convId;
  });
}

export async function createGroup(
  creatorId: string,
  title: string,
  memberIdsIn: string[],
  avatarUrl: string | null = null,
): Promise<string> {
  const id = newId();
  const others = [...new Set(memberIdsIn)].filter((m) => m !== creatorId);
  await tx(async (c) => {
    await c.query(
      `INSERT INTO conversations (id, kind, title, avatar_url, created_by) VALUES (?, 'group', ?, ?, ?)`,
      [id, title, avatarUrl, creatorId],
    );
    const rows = [[id, creatorId, 'admin'], ...others.map((m) => [id, m, 'member'])];
    await c.query('INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ?', [
      rows,
    ]);
  });
  return id;
}

export async function addMembers(conversationId: string, userIds: string[]): Promise<void> {
  if (!userIds.length) return;
  await db().query(
    'INSERT IGNORE INTO conversation_members (conversation_id, user_id, role) VALUES ?',
    [userIds.map((u) => [conversationId, u, 'member'])],
  );
}

export async function removeMember(conversationId: string, userId: string): Promise<void> {
  await db().query('DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [
    conversationId,
    userId,
  ]);
}

export async function setRole(
  conversationId: string,
  userId: string,
  role: 'admin' | 'member',
): Promise<void> {
  await db().query(
    'UPDATE conversation_members SET role = ? WHERE conversation_id = ? AND user_id = ?',
    [role, conversationId, userId],
  );
}

export async function updateGroup(
  id: string,
  patch: { title?: string; avatarUrl?: string | null },
): Promise<void> {
  if (patch.title !== undefined)
    await db().query('UPDATE conversations SET title = ? WHERE id = ?', [patch.title, id]);
  if (patch.avatarUrl !== undefined)
    await db().query('UPDATE conversations SET avatar_url = ? WHERE id = ?', [patch.avatarUrl, id]);
}

export async function setMemberFlags(
  conversationId: string,
  userId: string,
  flags: { pinned?: boolean; muted?: boolean; aiEnabled?: boolean },
): Promise<void> {
  const map = { pinned: 'pinned', muted: 'muted', aiEnabled: 'ai_enabled' } as const;
  const keys = (Object.keys(map) as (keyof typeof map)[]).filter((k) => flags[k] !== undefined);
  if (!keys.length) return;
  await db().query(
    `UPDATE conversation_members SET ${keys.map((k) => `${map[k]} = ?`).join(', ')} WHERE conversation_id = ? AND user_id = ?`,
    [...keys.map((k) => (flags[k] ? 1 : 0)), conversationId, userId],
  );
}

/**
 * Advance a member's delivered/read watermark. Watermarks only move forward (ULIDs sort by time), so
 * duplicate or out-of-order receipts are harmless. Read implies delivered.
 */
export async function advanceWatermark(
  conversationId: string,
  userId: string,
  upToId: string,
  status: 'delivered' | 'read',
): Promise<void> {
  await db().query(
    `UPDATE conversation_members SET
       last_delivered_message_id = IF(last_delivered_message_id IS NULL OR last_delivered_message_id < ?, ?, last_delivered_message_id)
     WHERE conversation_id = ? AND user_id = ?`,
    [upToId, upToId, conversationId, userId],
  );
  if (status === 'read') {
    await db().query(
      `UPDATE conversation_members SET
         last_read_message_id = IF(last_read_message_id IS NULL OR last_read_message_id < ?, ?, last_read_message_id)
       WHERE conversation_id = ? AND user_id = ?`,
      [upToId, upToId, conversationId, userId],
    );
  }
}

export interface Watermark {
  userId: string;
  delivered: string | null;
  read: string | null;
}

export async function watermarks(conversationId: string): Promise<Watermark[]> {
  const [rows] = await db().query<RowDataPacket[]>(
    'SELECT user_id, last_delivered_message_id AS d, last_read_message_id AS r FROM conversation_members WHERE conversation_id = ?',
    [conversationId],
  );
  return rows.map((r) => ({
    userId: r.user_id as string,
    delivered: r.d ?? null,
    read: r.r ?? null,
  }));
}

/** Rebuild unread counts from MySQL (used when Valkey is cold). */
export async function unreadFromDb(userId: string): Promise<Record<string, number>> {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT cm.conversation_id AS id, COUNT(m.id) AS n
     FROM conversation_members cm
     JOIN messages m ON m.conversation_id = cm.conversation_id
       AND m.sender_id <> cm.user_id
       AND m.deleted_at IS NULL
       AND (cm.last_read_message_id IS NULL OR m.id > cm.last_read_message_id)
     WHERE cm.user_id = ?
     GROUP BY cm.conversation_id`,
    [userId],
  );
  return Object.fromEntries(rows.map((r) => [r.id as string, Number(r.n)]));
}
