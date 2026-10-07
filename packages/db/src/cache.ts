import { createValkey } from '@pulse/aiven';
import type { Redis } from 'ioredis';
import { conversationIdsFor, memberIds, unreadFromDb } from './conversations';

/**
 * Valkey: every key here is a derived view of MySQL and can be rebuilt from it.
 *
 *   members:{conv}        SET   member user IDs (membership checks)        TTL 1h
 *   convs:{user}          SET   the user's conversation IDs                 TTL 1h
 *   unread:{user}         HASH  conv → unread count
 *   chats:{user}          ZSET  conv → last-message epoch ms (chat list order)
 *   presence:{user}       STR   socket count, TTL refreshed by heartbeat     TTL 60s
 *   lastseen:{user}       STR   ISO timestamp
 *   typing:{conv}:{user}  STR   1                                            TTL 6s
 *   seen:{group}:{msg}    STR   consumer idempotency marker                  TTL 1d
 *   otp:{email}           HASH  { hash, attempts }                           TTL 10m
 *   sess:{sid}            HASH  { userId, secretHash, createdAt }            TTL 30d
 *   rl:{bucket}:{id}      STR   fixed-window counter
 *   stats:*               counters for the Under the Hood page
 */
let client: Redis | undefined;

export function valkey(): Redis {
  client ??= createValkey();
  return client;
}

export async function closeValkey(): Promise<void> {
  await client?.quit().catch(() => {});
  client = undefined;
}

const HOUR = 3600;

export const keys = {
  members: (c: string) => `members:${c}`,
  convs: (u: string) => `convs:${u}`,
  unread: (u: string) => `unread:${u}`,
  chats: (u: string) => `chats:${u}`,
  presence: (u: string) => `presence:${u}`,
  lastSeen: (u: string) => `lastseen:${u}`,
  typing: (c: string, u: string) => `typing:${c}:${u}`,
  seen: (group: string, id: string) => `seen:${group}:${id}`,
  otp: (email: string) => `otp:${email}`,
  session: (sid: string) => `sess:${sid}`,
  rate: (bucket: string, id: string) => `rl:${bucket}:${id}`,
};

/** Track cache hits/misses so the Under the Hood page can show a real hit rate. */
async function stat(hit: boolean): Promise<void> {
  await valkey().incr(hit ? 'stats:cache:hit' : 'stats:cache:miss');
}

/** Membership check, served from Valkey and filled from MySQL on miss. */
export async function isMember(conversationId: string, userId: string): Promise<boolean> {
  const v = valkey();
  const key = keys.members(conversationId);
  const [exists, member] = await v
    .multi()
    .exists(key)
    .sismember(key, userId)
    .exec()
    .then((r) => r!.map((x) => x[1]));
  if (exists) {
    void stat(true);
    return member === 1;
  }
  void stat(false);
  const ids = await memberIds(conversationId);
  if (ids.length)
    await v
      .multi()
      .sadd(key, ...ids)
      .expire(key, HOUR)
      .exec();
  return ids.includes(userId);
}

export async function cachedMemberIds(conversationId: string): Promise<string[]> {
  const v = valkey();
  const key = keys.members(conversationId);
  const ids = await v.smembers(key);
  if (ids.length) {
    void stat(true);
    return ids;
  }
  void stat(false);
  const fresh = await memberIds(conversationId);
  if (fresh.length)
    await v
      .multi()
      .sadd(key, ...fresh)
      .expire(key, HOUR)
      .exec();
  return fresh;
}

export async function cachedConversationIds(userId: string): Promise<string[]> {
  const v = valkey();
  const key = keys.convs(userId);
  const ids = await v.smembers(key);
  if (ids.length) return ids;
  const fresh = await conversationIdsFor(userId);
  if (fresh.length)
    await v
      .multi()
      .sadd(key, ...fresh)
      .expire(key, HOUR)
      .exec();
  return fresh;
}

/** Drop membership caches after members change. */
export async function invalidateMembership(
  conversationId: string,
  userIds: string[],
): Promise<void> {
  await valkey().del(keys.members(conversationId), ...userIds.map(keys.convs));
}

export async function getUnread(userId: string): Promise<Record<string, number>> {
  const v = valkey();
  const key = keys.unread(userId);
  if (!(await v.exists(key))) {
    const fresh = await unreadFromDb(userId);
    // A sentinel field marks the hash as built even when everything is read.
    await v.hset(key, {
      _built: '1',
      ...Object.fromEntries(Object.entries(fresh).map(([k, n]) => [k, String(n)])),
    });
    return fresh;
  }
  const raw = await v.hgetall(key);
  delete raw._built;
  return Object.fromEntries(Object.entries(raw).map(([k, n]) => [k, Math.max(0, Number(n))]));
}

export async function clearUnread(userId: string, conversationId: string): Promise<void> {
  await valkey().hdel(keys.unread(userId), conversationId);
}

/** Fixed-window rate limit. Returns true if the call is allowed. */
export async function rateLimit(
  bucket: string,
  id: string,
  max: number,
  windowSec: number,
): Promise<boolean> {
  const key = keys.rate(bucket, id);
  const [[, count]] = (await valkey().multi().incr(key).expire(key, windowSec, 'NX').exec()) as [
    [null, number],
  ];
  return count <= max;
}

/** Mark-once helper for idempotent Kafka consumers. Returns true the first time only. */
export async function firstTime(group: string, id: string): Promise<boolean> {
  return (await valkey().set(keys.seen(group, id), '1', 'EX', 24 * HOUR, 'NX')) === 'OK';
}
