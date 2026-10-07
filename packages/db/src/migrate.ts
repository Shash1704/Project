import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { loadRootEnv } from '@pulse/aiven';
import type { RowDataPacket } from 'mysql2';
import { closeDb, db, pgdb } from './client';

const dir = (engine: 'mysql' | 'pg') =>
  fileURLToPath(new URL(`../migrations/${engine}/`, import.meta.url));

/** Split a migration file into statements (our DDL never contains semicolons inside literals). */
export function splitSql(sql: string): string[] {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function files(engine: 'mysql' | 'pg'): string[] {
  return readdirSync(dir(engine))
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

export async function migrateMysql(log = console.log): Promise<void> {
  const pool = db();
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(128) NOT NULL PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))',
  );
  const [rows] = await pool.query<RowDataPacket[]>('SELECT name FROM schema_migrations');
  const done = new Set(rows.map((r) => r.name as string));
  for (const f of files('mysql')) {
    if (done.has(f)) continue;
    // MySQL DDL auto-commits, so each statement applies on its own; files are written to be re-runnable.
    for (const stmt of splitSql(readFileSync(dir('mysql') + f, 'utf8'))) await pool.query(stmt);
    await pool.query('INSERT INTO schema_migrations (name) VALUES (?)', [f]);
    log(`mysql: applied ${f}`);
  }
}

export async function migratePg(log = console.log): Promise<void> {
  const pool = pgdb();
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
  );
  const { rows } = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
  const done = new Set(rows.map((r) => r.name));
  for (const f of files('pg')) {
    if (done.has(f)) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(readFileSync(dir('pg') + f, 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      await client.query('COMMIT');
      log(`pg: applied ${f}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

async function main() {
  loadRootEnv();
  await migrateMysql();
  if (process.env.PG_URL?.trim()) await migratePg();
  else console.log('pg: PG_URL not set, skipped (needed later for semantic search)');
  console.log('Migrations up to date.');
  await closeDb();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (e) => {
    const { errorMessage } = await import('@pulse/aiven');
    console.error(`Migration failed: ${errorMessage(e)}`);
    process.exit(1);
  });
}
