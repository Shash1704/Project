import type { UserDto } from '@pulse/shared';
import { db } from './client';
import { newId } from './ids';
import { toUser, type UserRow } from './rows';

export async function getUser(id: string): Promise<UserDto | null> {
  const [rows] = await db().query<UserRow[]>('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0] ? toUser(rows[0], true) : null;
}

export async function getUsers(ids: string[]): Promise<UserDto[]> {
  if (!ids.length) return [];
  const [rows] = await db().query<UserRow[]>('SELECT * FROM users WHERE id IN (?)', [ids]);
  return rows.map((r) => toUser(r));
}

export async function findUserByEmail(email: string): Promise<UserDto | null> {
  const [rows] = await db().query<UserRow[]>('SELECT * FROM users WHERE email = ?', [
    email.toLowerCase(),
  ]);
  return rows[0] ? toUser(rows[0], true) : null;
}

/** Create the user on first OTP login; returns the existing one otherwise. */
export async function upsertUserByEmail(email: string, name: string): Promise<UserDto> {
  const normal = email.toLowerCase();
  const id = newId();
  await db().query(
    'INSERT INTO users (id, email, name, avatar_seed) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
    [id, normal, name, normal],
  );
  return (await findUserByEmail(normal))!;
}

export async function listDemoUsers(): Promise<UserDto[]> {
  const [rows] = await db().query<UserRow[]>(
    'SELECT * FROM users WHERE is_demo = 1 ORDER BY email',
  );
  return rows.map((r) => toUser(r));
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<UserDto, 'name' | 'about' | 'lang' | 'avatarUrl'>>,
): Promise<void> {
  const map = { name: 'name', about: 'about', lang: 'lang', avatarUrl: 'avatar_url' } as const;
  const entries = (Object.keys(map) as (keyof typeof map)[]).filter((k) => patch[k] !== undefined);
  const cols = entries.map((k) => `${map[k]} = ?`);
  const vals = entries.map((k) => patch[k]);
  if (!cols.length) return;
  await db().query(`UPDATE users SET ${cols.join(', ')} WHERE id = ?`, [...vals, id]);
}

export async function touchLastSeen(id: string, at = new Date()): Promise<void> {
  await db().query('UPDATE users SET last_seen_at = ? WHERE id = ?', [at, id]);
}

export async function searchUsers(q: string, excludeId: string, limit = 20): Promise<UserDto[]> {
  const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
  const [rows] = await db().query<UserRow[]>(
    'SELECT * FROM users WHERE id <> ? AND (name LIKE ? OR email LIKE ?) ORDER BY is_demo DESC, name LIMIT ?',
    [excludeId, like, like, limit],
  );
  return rows.map((r) => toUser(r));
}
