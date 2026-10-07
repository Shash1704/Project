import { cachedMemberIds, firstTime, getMedia, keys, valkey } from '@pulse/db';
import { TOPICS, messageSentEvent, type MessageDto } from '@pulse/shared';
import { sockets } from '../emitter';
import { runConsumer } from '../kafka';

/**
 * messages.sent → push to every member's sockets, bump unread counters and chat-list order in Valkey.
 * Runs independently of the DB writer, so delivery latency never waits on MySQL.
 */
export const startFanout = () =>
  runConsumer({
    group: 'fanout',
    topic: TOPICS.messagesSent,
    schema: messageSentEvent,
    handle: async (e) => {
      if (!(await firstTime('fanout', e.id))) return;
      // Media rows are written at upload time, so they exist before the message is sent.
      const media = e.mediaId ? await getMedia(e.mediaId) : null;
      const dto: MessageDto = {
        id: e.id,
        conversationId: e.conversationId,
        senderId: e.senderId,
        kind: e.kind,
        body: e.body,
        replyToId: e.replyToId,
        media,
        createdAt: e.createdAt,
        editedAt: null,
        deletedAt: null,
        status: 'sent',
      };
      sockets().to(`conv:${e.conversationId}`).emit('message:new', dto);

      const members = await cachedMemberIds(e.conversationId);
      const v = valkey();
      const score = Date.parse(e.createdAt);
      const tx = v.multi();
      for (const u of members) {
        tx.zadd(keys.chats(u), score, e.conversationId);
        if (u !== e.senderId) tx.eval(INCR_IF_BUILT, 1, keys.unread(u), e.conversationId);
      }
      tx.incr('stats:messages:delivered');
      await tx.exec();
    },
  });

/** Only bump an unread hash that has been built from MySQL; a cold hash is rebuilt on next read. */
const INCR_IF_BUILT = `if redis.call('HEXISTS', KEYS[1], '_built') == 1 then return redis.call('HINCRBY', KEYS[1], ARGV[1], 1) end return 0`;
