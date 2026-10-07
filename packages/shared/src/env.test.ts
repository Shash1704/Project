import { describe, expect, it } from 'vitest';
import { appEnv, kafkaEnv, mysqlEnv, parseEnv, valkeyEnv } from './env';

describe('parseEnv', () => {
  it('names missing variables without leaking values', () => {
    expect(() => parseEnv(mysqlEnv, {})).toThrow('MYSQL_URL is not set');
  });

  it('rejects an invalid value without echoing it', () => {
    const secret = 'redis://user:hunter2@host:1234';
    try {
      parseEnv(valkeyEnv, { VALKEY_URL: secret });
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toBe('VALKEY_URL is invalid');
      expect((e as Error).message).not.toContain('hunter2');
    }
  });

  it('requires TLS for Valkey', () => {
    expect(parseEnv(valkeyEnv, { VALKEY_URL: 'rediss://default:x@h:1' }).VALKEY_URL).toMatch(
      /^rediss:/,
    );
  });

  it('splits Kafka brokers and applies defaults', () => {
    const env = parseEnv(kafkaEnv, {
      KAFKA_BROKERS: 'a:1, b:2,',
      KAFKA_SASL_USERNAME: 'u',
      KAFKA_SASL_PASSWORD: 'p',
    });
    expect(env.KAFKA_BROKERS).toEqual(['a:1', 'b:2']);
    expect(env.KAFKA_SASL_MECHANISM).toBe('scram-sha-256');
  });

  it('defaults app ports away from common dev ports', () => {
    expect(parseEnv(appEnv, {})).toMatchObject({
      API_PORT: 4100,
      WEB_ORIGIN: 'http://localhost:3100',
    });
  });
});

describe('blank values', () => {
  it('treats an empty CA line as unset, and an empty required var as not set', () => {
    expect(() => parseEnv(mysqlEnv, { MYSQL_URL: 'mysql://u:p@h:1/db', MYSQL_CA_CERT_BASE64: '' })).not.toThrow();
    expect(() => parseEnv(valkeyEnv, { VALKEY_URL: '' })).toThrow('VALKEY_URL is not set');
  });
});

describe('blank optional values', () => {
  it('ignores blank optional vars instead of failing', async () => {
    const { authEnv } = await import('./env');
    expect(() => parseEnv(authEnv, { JWT_SECRET: 'x'.repeat(40), RESEND_API_KEY: '' })).not.toThrow();
  });
});
