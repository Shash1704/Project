import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCaCert } from './ca';

const PEM = '-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----\n';

describe('loadCaCert', () => {
  it('reads from a file path', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'pulse-ca-')), 'ca.pem');
    writeFileSync(file, PEM);
    expect(loadCaCert('MYSQL', { MYSQL_CA_CERT_PATH: file })).toBe(PEM);
  });

  it('decodes base64', () => {
    const b64 = Buffer.from(PEM).toString('base64');
    expect(loadCaCert('PG', { PG_CA_CERT_BASE64: b64 })).toBe(PEM);
  });

  it('prefers the path when both are set', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'pulse-ca-')), 'ca.pem');
    writeFileSync(file, PEM);
    expect(
      loadCaCert('KAFKA', { KAFKA_CA_CERT_PATH: file, KAFKA_CA_CERT_BASE64: 'bm9wZQ==' }),
    ).toBe(PEM);
  });

  it('fails clearly when neither is set', () => {
    expect(() => loadCaCert('MYSQL', {})).toThrow('Set MYSQL_CA_CERT_PATH or MYSQL_CA_CERT_BASE64');
  });

  it('rejects content that is not a PEM certificate', () => {
    expect(() =>
      loadCaCert('PG', { PG_CA_CERT_BASE64: Buffer.from('hello').toString('base64') }),
    ).toThrow('not a PEM certificate');
  });

  it('does not leak the path contents of an unreadable file', () => {
    expect(() => loadCaCert('PG', { PG_CA_CERT_PATH: '/nope/secret-dir/ca.pem' })).toThrow(
      'PG_CA_CERT_PATH points to a file that cannot be read',
    );
  });
});

describe('loadCaCert relative paths', () => {
  it('resolves relative to the repo root, whatever the cwd', () => {
    const root = mkdtempSync(join(tmpdir(), 'pulse-root-'));
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
    mkdirSync(join(root, 'certs'));
    mkdirSync(join(root, 'apps', 'api'), { recursive: true });
    writeFileSync(join(root, 'certs', 'ca.pem'), PEM);
    const cwd = process.cwd();
    try {
      process.chdir(join(root, 'apps', 'api'));
      expect(loadCaCert('MYSQL', { MYSQL_CA_CERT_PATH: './certs/ca.pem' })).toBe(PEM);
    } finally {
      process.chdir(cwd);
    }
  });
});
