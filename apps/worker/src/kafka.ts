import { createKafka, errorMessage } from '@pulse/aiven';
import { valkey } from '@pulse/db';
import type { Consumer, EachMessagePayload } from 'kafkajs';
import type { z } from 'zod';

const consumers: Consumer[] = [];

/**
 * One consumer group per job. Values are validated with zod; a malformed record is logged and skipped
 * (it would never succeed on retry). Handler errors propagate so kafkajs retries — handlers must be
 * idempotent because delivery is at-least-once.
 */
export async function runConsumer<S extends z.ZodType>(opts: {
  group: string;
  topic: string;
  schema: S;
  handle: (value: z.infer<S>, ctx: EachMessagePayload) => Promise<void>;
}): Promise<Consumer> {
  const consumer = createKafka().consumer({
    groupId: `pulse-${opts.group}`,
    allowAutoTopicCreation: false,
  });
  await consumer.connect();
  await consumer.subscribe({ topic: opts.topic, fromBeginning: false });
  await consumer.run({
    eachMessage: async (ctx) => {
      const raw = ctx.message.value?.toString('utf8') ?? '';
      let value: z.infer<S>;
      try {
        value = opts.schema.parse(JSON.parse(raw));
      } catch {
        console.warn(
          `[${opts.group}] skipped malformed record at ${ctx.topic}/${ctx.partition}@${ctx.message.offset}`,
        );
        return;
      }
      try {
        await opts.handle(value, ctx);
        await valkey().incr(`stats:consumed:${opts.group}`);
      } catch (e) {
        console.error(`[${opts.group}] ${errorMessage(e)}`);
        throw e;
      }
    },
  });
  consumers.push(consumer);
  console.log(`[worker] ${opts.group} consuming ${opts.topic}`);
  return consumer;
}

export async function stopConsumers(): Promise<void> {
  await Promise.all(consumers.map((c) => c.disconnect().catch(() => {})));
}
