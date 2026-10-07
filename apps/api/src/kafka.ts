import { createKafka } from '@pulse/aiven';
import {
  TOPICS,
  type AnalyticsEvent,
  type MessageSentEvent,
  type PresenceEvent,
  type ReceiptEvent,
} from '@pulse/shared';
import { CompressionTypes, type Producer } from 'kafkajs';

let producer: Producer | undefined;
let connecting: Promise<Producer> | undefined;

async function getProducer(): Promise<Producer> {
  if (producer) return producer;
  connecting ??= (async () => {
    // Idempotent producer: retries never duplicate a record within a partition.
    const p = createKafka().producer({
      idempotent: true,
      maxInFlightRequests: 1,
      allowAutoTopicCreation: false,
    });
    await p.connect();
    producer = p;
    return p;
  })().finally(() => {
    connecting = undefined;
  });
  return connecting;
}

async function send(topic: string, key: string, value: object): Promise<void> {
  const p = await getProducer();
  await p.send({
    topic,
    compression: CompressionTypes.GZIP,
    messages: [{ key, value: JSON.stringify(value) }],
  });
}

/** Partition key = conversation ID, so a conversation's messages stay ordered. */
export const publishMessage = (e: MessageSentEvent) =>
  send(TOPICS.messagesSent, e.conversationId, e);
export const publishReceipt = (e: ReceiptEvent) =>
  send(TOPICS.messagesReceipts, e.conversationId, e);
export const publishPresence = (e: PresenceEvent) => send(TOPICS.presenceEvents, e.userId, e);

/** Fire-and-forget analytics; never fails the caller. */
export async function publishAnalytics(
  e: Omit<AnalyticsEvent, 'v' | 'at' | 'meta'> & { meta?: AnalyticsEvent['meta'] },
) {
  try {
    await send(TOPICS.analyticsEvents, e.conversationId ?? e.userId, {
      v: 1,
      at: new Date().toISOString(),
      meta: {},
      ...e,
    });
  } catch {
    /* analytics is best-effort */
  }
}

export async function disconnectProducer(): Promise<void> {
  await producer?.disconnect().catch(() => {});
  producer = undefined;
}
