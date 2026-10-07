import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { keys, newId, valkey } from '@pulse/db';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../env';

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ACCESS_TTL_SEC = 15 * 60;
export const SESSION_TTL_SEC = 30 * 24 * 3600;

export interface AccessClaims {
  sub: string;
  sid: string;
}

export async function signAccess(
  userId: string,
  sid: string,
): Promise<{ token: string; expiresAt: number }> {
  const exp = Math.floor(Date.now() / 1000) + ACCESS_TTL_SEC;
  const token = await new SignJWT({ sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(exp)
    .setIssuer('pulse')
    .sign(secret);
  return { token, expiresAt: exp * 1000 };
}

export async function verifyAccess(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, secret, { issuer: 'pulse', algorithms: ['HS256'] });
  if (!payload.sub || typeof payload.sid !== 'string') throw new Error('bad token');
  return { sub: payload.sub, sid: payload.sid };
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** Sessions live in Valkey so they can be revoked instantly. The refresh token is `sid.secret`. */
export async function createSession(
  userId: string,
): Promise<{ sid: string; refreshToken: string }> {
  const sid = newId();
  const s = randomBytes(32).toString('base64url');
  await valkey()
    .multi()
    .hset(keys.session(sid), { userId, secretHash: sha(s), createdAt: new Date().toISOString() })
    .expire(keys.session(sid), SESSION_TTL_SEC)
    .exec();
  return { sid, refreshToken: `${sid}.${s}` };
}

/** Validate a refresh token and rotate its secret (a replayed old token fails and kills the session). */
export async function rotateSession(
  refreshToken: string,
): Promise<{ userId: string; sid: string; refreshToken: string } | null> {
  const [sid, s] = refreshToken.split('.');
  if (!sid || !s) return null;
  const sess = await valkey().hgetall(keys.session(sid));
  if (!sess.userId || !sess.secretHash) return null;
  const a = Buffer.from(sess.secretHash, 'hex');
  const b = Buffer.from(sha(s), 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await revokeSession(sid);
    return null;
  }
  const next = randomBytes(32).toString('base64url');
  await valkey()
    .multi()
    .hset(keys.session(sid), { secretHash: sha(next) })
    .expire(keys.session(sid), SESSION_TTL_SEC)
    .exec();
  return { userId: sess.userId, sid, refreshToken: `${sid}.${next}` };
}

export async function sessionAlive(sid: string): Promise<boolean> {
  return (await valkey().exists(keys.session(sid))) === 1;
}

export async function revokeSession(sid: string): Promise<void> {
  await valkey().del(keys.session(sid));
}
