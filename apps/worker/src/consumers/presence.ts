import { cachedConversationIds, keys, touchLastSeen, valkey } from '@pulse/db';
import { TOPICS, presenceEvent } from '@pulse/shared';
import { sockets } from '../emitter';
import { runConsumer } from '../kafka';

/** presence.events → last-seen in MySQL + Valkey, broadcast to everyone who shares a chat with the user. */
export const startPresence = () =>
  runConsumer({
    group: 'presence',
    topic: TOPICS.presenceEvents,
    schema: presenceEvent,
    handle: async (e) => {
      const online = e.state === 'online';
      if (!online) {
        await touchLastSeen(e.userId, new Date(e.at));
        await valkey().set(keys.lastSeen(e.userId), e.at);
      }
      const rooms = (await cachedConversationIds(e.userId)).map((c) => `conv:${c}`);
      if (rooms.length) {
        sockets()
          .to(rooms)
          .emit('presence', { userId: e.userId, online, lastSeenAt: online ? null : e.at });
      }
    },
  });
