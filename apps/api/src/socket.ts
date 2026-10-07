import type { Server as HttpServer } from 'node:http';
import { errorMessage } from '@pulse/aiven';
import { cachedConversationIds, clearUnread, isMember, keys, rateLimit, valkey } from '@pulse/db';
import {
  joinInput,
  receiptInput,
  sendMessageInput,
  typingInput,
  type ClientToServer,
  type ServerToClient,
} from '@pulse/shared';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server, type Socket } from 'socket.io';
import { sessionAlive, verifyAccess } from './auth/tokens';
import { env, isProd } from './env';
import { publishAnalytics, publishMessage, publishPresence, publishReceipt } from './kafka';
import { setIo } from './socket-ref';

type IO = Server<
  ClientToServer,
  ServerToClient,
  Record<string, never>,
  { userId: string; sid: string }
>;
type S = Socket<
  ClientToServer,
  ServerToClient,
  Record<string, never>,
  { userId: string; sid: string }
>;

const PRESENCE_TTL_SEC = 90;
const HEARTBEAT_MS = 30_000;

export function createSocketServer(http: HttpServer): IO {
  const io: IO = new Server(http, {
    // Production: only the web app's origin. Dev: also private-network origins, so phones/laptops on the
    // same Wi-Fi can open http://<this-mac-ip>:3100.
    cors: {
      origin: isProd
        ? env.WEB_ORIGIN
        : [env.WEB_ORIGIN, /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/],
      credentials: true,
    },
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
    pingInterval: 20_000,
  });

  // Valkey adapter: any API instance (and the worker's emitter) can reach any socket.
  const pub = valkey().duplicate();
  const sub = valkey().duplicate();
  pub.on('error', () => {});
  sub.on('error', () => {});
  io.adapter(createAdapter(pub, sub));
  setIo(io as unknown as Server<ClientToServer, ServerToClient>);

  io.use(async (socket, next) => {
    try {
      const token = String(socket.handshake.auth?.token ?? '');
      const claims = await verifyAccess(token);
      if (!(await sessionAlive(claims.sid))) throw new Error('revoked');
      socket.data.userId = claims.sub;
      socket.data.sid = claims.sid;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    void onConnect(io, socket).catch((e) => console.error(`[socket] connect: ${errorMessage(e)}`));
  });

  return io;
}

async function onConnect(io: IO, socket: S) {
  const userId = socket.data.userId;
  // Handlers are attached synchronously below; room joins and presence happen in the background so an
  // event emitted right after connect is never dropped.
  void (async () => {
    const convIds = await cachedConversationIds(userId);
    await socket.join([`user:${userId}`, ...convIds.map((c) => `conv:${c}`)]);
    await markOnline(userId);
  })().catch((e) => console.error(`[socket] join/presence: ${errorMessage(e)}`));
  const beat = setInterval(() => void valkey().expire(keys.presence(userId), PRESENCE_TTL_SEC), HEARTBEAT_MS);

  const guard =
    <T>(fn: (input: T) => Promise<void>) =>
    (input: T) =>
      void fn(input).catch((e) => console.error(`[socket] ${errorMessage(e)}`));

  socket.on('message:send', (raw, ack) => {
    void (async () => {
      const parsed = sendMessageInput.safeParse(raw);
      if (!parsed.success) return ack?.({ ok: false, error: 'Invalid message' });
      const m = parsed.data;
      if (!(await rateLimit('send', userId, 30, 10)))
        return ack?.({ ok: false, error: 'Slow down a little' });
      if (!(await isMember(m.conversationId, userId)))
        return ack?.({ ok: false, error: 'Not a member' });
      await publishMessage({
        v: 1,
        id: m.id,
        conversationId: m.conversationId,
        senderId: userId,
        kind: m.kind,
        body: m.body ?? null,
        replyToId: m.replyToId ?? null,
        mediaId: m.mediaId ?? null,
        createdAt: new Date().toISOString(),
      });
      await valkey().incr('stats:messages:produced');
      ack?.({ ok: true });
      void publishAnalytics({
        type: 'message',
        userId,
        conversationId: m.conversationId,
        meta: { kind: m.kind },
      });
    })().catch((e) => {
      console.error(`[socket] send: ${errorMessage(e)}`);
      ack?.({ ok: false, error: 'Could not send, retrying' });
    });
  });

  socket.on(
    'typing',
    guard(async (raw) => {
      const t = typingInput.parse(raw);
      if (!(await rateLimit('typing', userId, 40, 10))) return;
      if (!(await isMember(t.conversationId, userId))) return;
      const key = keys.typing(t.conversationId, userId);
      if (t.typing) await valkey().set(key, '1', 'EX', 6);
      else await valkey().del(key);
      socket
        .to(`conv:${t.conversationId}`)
        .emit('typing', { conversationId: t.conversationId, userId, typing: t.typing });
    }),
  );

  socket.on(
    'receipt',
    guard(async (raw) => {
      const r = receiptInput.parse(raw);
      if (!(await rateLimit('receipt', userId, 120, 10))) return;
      if (!(await isMember(r.conversationId, userId))) return;
      if (r.status === 'read') await clearUnread(userId, r.conversationId);
      await publishReceipt({
        v: 1,
        conversationId: r.conversationId,
        userId,
        upToId: r.upToId,
        status: r.status,
        at: new Date().toISOString(),
      });
    }),
  );

  socket.on(
    'conversation:join',
    guard(async (raw) => {
      const { conversationId } = joinInput.parse(raw);
      if (await isMember(conversationId, userId)) await socket.join(`conv:${conversationId}`);
    }),
  );

  socket.on('disconnect', () => {
    clearInterval(beat);
    void markOffline(userId).catch(() => {});
  });

  void io; // io kept for future per-connection broadcasts
}

/** Presence is a per-user socket count in Valkey; transitions go through `presence.events`. */
async function markOnline(userId: string) {
  const [[, count]] = (await valkey()
    .multi()
    .incr(keys.presence(userId))
    .expire(keys.presence(userId), PRESENCE_TTL_SEC)
    .exec()) as [[null, number]];
  if (count === 1)
    await publishPresence({ v: 1, userId, state: 'online', at: new Date().toISOString() });
}

async function markOffline(userId: string) {
  const left = await valkey().decr(keys.presence(userId));
  if (left <= 0) {
    await valkey().del(keys.presence(userId));
    await publishPresence({ v: 1, userId, state: 'offline', at: new Date().toISOString() });
  }
}
