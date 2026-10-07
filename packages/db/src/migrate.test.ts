import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { splitSql } from './migrate';

describe('splitSql', () => {
  it('splits statements and drops comments', () => {
    expect(splitSql('-- hi\nCREATE TABLE a (x INT);\n\nCREATE TABLE b (y INT);\n')).toEqual([
      'CREATE TABLE a (x INT)',
      'CREATE TABLE b (y INT)',
    ]);
  });

  it('every MySQL table has a primary key and is re-runnable', () => {
    const sql = readFileSync(
      fileURLToPath(new URL('../migrations/mysql/001_init.sql', import.meta.url)),
      'utf8',
    );
    const stmts = splitSql(sql);
    expect(stmts.length).toBe(8);
    for (const s of stmts) {
      expect(s).toMatch(/^CREATE TABLE IF NOT EXISTS/);
      expect(s).toMatch(/PRIMARY KEY/);
    }
  });

  it('messages are indexed for recent-history loads', () => {
    const sql = readFileSync(
      fileURLToPath(new URL('../migrations/mysql/001_init.sql', import.meta.url)),
      'utf8',
    );
    expect(sql).toMatch(/KEY ix_messages_conv_created \(conversation_id, created_at\)/);
  });
});
