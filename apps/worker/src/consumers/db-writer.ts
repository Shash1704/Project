import { persistMessage, valkey } from '@pulse/db';
import { TOPICS, messageSentEvent } from '@pulse/shared';
import { runConsumer } from '../kafka';

/** messages.sent → MySQL (source of truth). INSERT IGNORE on the message ID makes redelivery a no-op. */
export const startDbWriter = () =>
  runConsumer({
    group: 'db-writer',
    topic: TOPICS.messagesSent,
    schema: messageSentEvent,
    handle: async (e) => {
      const inserted = await persistMessage(e);
      if (inserted) await valkey().incr('stats:messages:persisted');
    },
  });
