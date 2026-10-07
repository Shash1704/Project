import { Client as OpenSearchClient } from '@opensearch-project/opensearch';
import { kafkaEnv, mysqlEnv, opensearchEnv, parseEnv, pgEnv, valkeyEnv } from '@pulse/shared';
import { Redis } from 'ioredis';
import { Kafka, logLevel } from 'kafkajs';
import mysql from 'mysql2/promise';
import pg from 'pg';
import { loadCaCert } from './ca';

/** Aiven URIs carry `ssl-mode` / `sslmode` query params; drivers must use our explicit TLS config instead. */
function withoutQuery(raw: string): URL {
  const url = new URL(raw);
  url.search = '';
  return url;
}

export function createMysqlPool(env: NodeJS.ProcessEnv = process.env): mysql.Pool {
  const { MYSQL_URL } = parseEnv(mysqlEnv, env);
  const url = withoutQuery(MYSQL_URL);
  return mysql.createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'defaultdb',
    ssl: { ca: loadCaCert('MYSQL', env), rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 8_000,
    timezone: 'Z',
  });
}

export function createPgPool(env: NodeJS.ProcessEnv = process.env): pg.Pool {
  const { PG_URL } = parseEnv(pgEnv, env);
  return new pg.Pool({
    connectionString: withoutQuery(PG_URL).toString(),
    ssl: { ca: loadCaCert('PG', env), rejectUnauthorized: true },
    max: 10,
    connectionTimeoutMillis: 8_000,
  });
}

export function createKafka(env: NodeJS.ProcessEnv = process.env): Kafka {
  const k = parseEnv(kafkaEnv, env);
  return new Kafka({
    clientId: k.KAFKA_CLIENT_ID,
    brokers: k.KAFKA_BROKERS,
    ssl: { ca: [loadCaCert('KAFKA', env)], rejectUnauthorized: true },
    sasl: {
      mechanism: k.KAFKA_SASL_MECHANISM,
      username: k.KAFKA_SASL_USERNAME,
      password: k.KAFKA_SASL_PASSWORD,
    } as never,
    connectionTimeout: 8_000,
    logLevel: logLevel.NOTHING,
  });
}

export function createValkey(
  env: NodeJS.ProcessEnv = process.env,
  opts: { lazy?: boolean } = {},
): Redis {
  const { VALKEY_URL } = parseEnv(valkeyEnv, env);
  return new Redis(VALKEY_URL, {
    lazyConnect: opts.lazy ?? false,
    connectTimeout: 8_000,
    maxRetriesPerRequest: 3,
  });
}

export function createOpenSearch(env: NodeJS.ProcessEnv = process.env): OpenSearchClient {
  const { OPENSEARCH_URL } = parseEnv(opensearchEnv, env);
  return new OpenSearchClient({ node: OPENSEARCH_URL, requestTimeout: 8_000 });
}
