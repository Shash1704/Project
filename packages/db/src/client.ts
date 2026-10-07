import { createMysqlPool, createPgPool } from '@pulse/aiven';
import type mysql from 'mysql2/promise';
import type pg from 'pg';

let mysqlPool: mysql.Pool | undefined;
let pgPool: pg.Pool | undefined;

/** Process-wide MySQL pool (lazy). */
export function db(): mysql.Pool {
  mysqlPool ??= createMysqlPool();
  return mysqlPool;
}

/** Process-wide PostgreSQL pool (lazy). */
export function pgdb(): pg.Pool {
  pgPool ??= createPgPool();
  return pgPool;
}

export async function closeDb(): Promise<void> {
  await Promise.all([mysqlPool?.end(), pgPool?.end()]);
  mysqlPool = undefined;
  pgPool = undefined;
}
