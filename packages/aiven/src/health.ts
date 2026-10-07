import { pathToFileURL } from 'node:url';
import { ALL_TOPICS } from '@pulse/shared';
import type { RowDataPacket } from 'mysql2';
import {
  createKafka,
  createMysqlPool,
  createOpenSearch,
  createPgPool,
  createValkey,
} from './clients';
import { loadRootEnv } from './load-env';
import { errorMessage } from './redact';

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
  ms: number;
}

type Check = { name: string; run: () => Promise<string> };

const TIMEOUT_MS = 8_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms / 1000}s`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export const checks: Check[] = [
  {
    name: 'MySQL',
    run: async () => {
      const pool = createMysqlPool();
      try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT VERSION() AS v');
        return `version ${rows[0]?.v}`;
      } finally {
        await pool.end().catch(() => {});
      }
    },
  },
  {
    name: 'PostgreSQL',
    run: async () => {
      const pool = createPgPool();
      try {
        const { rows } = await pool.query<{ v: string; vec: string | null }>(
          `SELECT current_setting('server_version') AS v,
                  (SELECT default_version FROM pg_available_extensions WHERE name = 'vector') AS vec`,
        );
        const row = rows[0];
        if (!row?.vec) throw new Error('pgvector extension is not available on this service');
        return `version ${row.v}, pgvector ${row.vec} available`;
      } finally {
        await pool.end().catch(() => {});
      }
    },
  },
  {
    name: 'Kafka',
    run: async () => {
      const admin = createKafka().admin();
      await admin.connect();
      try {
        const existing = new Set(await admin.listTopics());
        const missing = ALL_TOPICS.filter((t) => !existing.has(t));
        if (missing.length) throw new Error(`connected, but missing topics: ${missing.join(', ')}`);
        return `all ${ALL_TOPICS.length} topics present`;
      } finally {
        await admin.disconnect().catch(() => {});
      }
    },
  },
  {
    name: 'Valkey',
    run: async () => {
      const valkey = createValkey(process.env, { lazy: true });
      // Fail fast instead of ioredis' default infinite reconnect loop.
      valkey.options.retryStrategy = () => null;
      valkey.on('error', () => {});
      try {
        await valkey.connect();
        const pong = await valkey.ping();
        const info = await valkey.info('server');
        const version = info.match(/(?:valkey|redis)_version:(\S+)/)?.[1] ?? 'unknown';
        return `${pong}, version ${version}`;
      } finally {
        valkey.disconnect();
      }
    },
  },
  {
    name: 'OpenSearch',
    run: async () => {
      const client = createOpenSearch();
      try {
        const { body } = await client.cluster.health();
        if (body.status === 'red') throw new Error('cluster status is red');
        return `cluster ${body.status}, ${body.number_of_nodes} node(s)`;
      } finally {
        await client.close().catch(() => {});
      }
    },
  },
];

export async function runChecks(list: Check[] = checks): Promise<CheckResult[]> {
  return Promise.all(
    list.map(async ({ name, run }) => {
      const start = performance.now();
      try {
        const detail = await withTimeout(run(), TIMEOUT_MS);
        return { name, ok: true, detail, ms: Math.round(performance.now() - start) };
      } catch (err) {
        return {
          name,
          ok: false,
          detail: errorMessage(err),
          ms: Math.round(performance.now() - start),
        };
      }
    }),
  );
}

async function main() {
  loadRootEnv();
  console.log('Pulse · Aiven health check\n');
  const results = await runChecks();
  const width = Math.max(...results.map((r) => r.name.length));
  for (const r of results) {
    const status = r.ok ? '\x1b[32mOK  \x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`${status}  ${r.name.padEnd(width)}  ${r.detail} \x1b[2m(${r.ms}ms)\x1b[0m`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(
    failed
      ? `\n${failed} of ${results.length} services failed.`
      : `\nAll ${results.length} services OK.`,
  );
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
