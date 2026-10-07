import { advanceWatermark } from '@pulse/db';
import { TOPICS, receiptEvent } from '@pulse/shared';
import { sockets } from '../emitter';
import { runConsumer } from '../kafka';

/** messages.receipts → forward-only member watermarks in MySQL, then live tick updates to the room. */
export const startReceipts = () =>
  runConsumer({
    group: 'receipts',
    topic: TOPICS.messagesReceipts,
    schema: receiptEvent,
    handle: async (e) => {
      await advanceWatermark(e.conversationId, e.userId, e.upToId, e.status);
      sockets().to(`conv:${e.conversationId}`).emit('receipt', {
        conversationId: e.conversationId,
        userId: e.userId,
        upToId: e.upToId,
        status: e.status,
      });
    },
  });
