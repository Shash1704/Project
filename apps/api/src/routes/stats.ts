import { createKafka } from '@pulse/aiven';
import { countMessages, db, valkey } from '@pulse/db';
import { ALL_TOPICS } from '@pulse/shared';
import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { requireAuth } from '../auth/middleware';
import { h } from '../http-error';

export const statsRouter = Router();
statsRouter.use(requireAuth);

const GROUPS = ['fanout', 'db-writer', 'receipts', 'presence'];
let admin: ReturnType<ReturnType<typeof createKafka>['admin']> | undefined;
let lastSample: { at: number; offsets: Record<string, number> } | undefined;

async function kafkaAdmin() {
  if (!admin) {
    admin = createKafka().admin();
    await admin.connect();
  }
  return admin;
}

async function timed<T>(
  fn: () => Promise<T>,
): Promise<{ ms: number; value: T | null; ok: boolean }> {
  const t = performance.now();
  try {
    const value = await fn();
    return { ms: Math.round(performance.now() - t), value, ok: true };
  } catch {
    return { ms: Math.round(performance.now() - t), value: null, ok: false };
  }
}

/** Live numbers for the Under the Hood page: every value comes from a real Aiven service. */
statsRouter.get(
  '/',
  h(async (_req, res) => {
    const v = valkey();
    const [mysql, cache, kafka] = await Promise.all([
      timed(async () => {
        const [rows] = await db().query<RowDataPacket[]>(
          'SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM conversations) AS conversations',
        );
        return {
          messages: await countMessages(),
          users: Number(rows[0]?.users),
          conversations: Number(rows[0]?.conversations),
        };
      }),
      timed(async () => {
        const [hit, miss, produced, delivered, persisted, ...consumed] = await v.mget(
          'stats:cache:hit',
          'stats:cache:miss',
          'stats:messages:produced',
          'stats:messages:delivered',
          'stats:messages:persisted',
          ...GROUPS.map((g) => `stats:consumed:${g}`),
        );
        const info = await v.info('stats');
        const ksHits = Number(info.match(/keyspace_hits:(\d+)/)?.[1] ?? 0);
        const ksMiss = Number(info.match(/keyspace_misses:(\d+)/)?.[1] ?? 0);
        return {
          appHits: Number(hit ?? 0),
          appMisses: Number(miss ?? 0),
          keyspaceHits: ksHits,
          keyspaceMisses: ksMiss,
          produced: Number(produced ?? 0),
          delivered: Number(delivered ?? 0),
          persisted: Number(persisted ?? 0),
          consumed: Object.fromEntries(GROUPS.map((g, i) => [g, Number(consumed[i] ?? 0)])),
          keys: await v.dbsize(),
        };
      }),
      timed(async () => {
        const a = await kafkaAdmin();
        const topics = await Promise.all(
          ALL_TOPICS.map(async (topic) => {
            const offs = await a.fetchTopicOffsets(topic);
            return {
              topic,
              partitions: offs.length,
              end: offs.reduce((s, o) => s + Number(o.high), 0),
              offs,
            };
          }),
        );
        const lag = await Promise.all(
          GROUPS.map(async (group) => {
            const topic =
              group === 'receipts'
                ? 'messages.receipts'
                : group === 'presence'
                  ? 'presence.events'
                  : 'messages.sent';
            const t = topics.find((x) => x.topic === topic)!;
            const [committed] = await a.fetchOffsets({
              groupId: `pulse-${group}`,
              topics: [topic],
            });
            const total = (committed?.partitions ?? []).reduce((s, p) => {
              const high = Number(t.offs.find((o) => o.partition === p.partition)?.high ?? 0);
              const off = Number(p.offset);
              return s + (off < 0 ? high : Math.max(0, high - off));
            }, 0);
            return { group, topic, lag: total };
          }),
        );
        // Throughput: end-offset delta since the previous sample.
        const now = Date.now();
        const offsets = Object.fromEntries(topics.map((t) => [t.topic, t.end]));
        const rates = Object.fromEntries(
          topics.map((t) => [
            t.topic,
            lastSample
              ? Math.max(
                  0,
                  (t.end - (lastSample.offsets[t.topic] ?? t.end)) / ((now - lastSample.at) / 1000),
                )
              : 0,
          ]),
        );
        lastSample = { at: now, offsets };
        return {
          topics: topics.map(({ topic, partitions, end }) => ({
            topic,
            partitions,
            messages: end,
            perSec: rates[topic],
          })),
          lag,
        };
      }),
    ]);
    res.json({ at: new Date().toISOString(), mysql, valkey: cache, kafka });
  }),
);
