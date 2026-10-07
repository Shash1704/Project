import { describe, expect, it } from 'vitest';
import { redact } from './redact';

describe('redact', () => {
  it('removes service URIs', () => {
    expect(
      redact('connect failed: mysql://avnadmin:s3cr3t@host.aivencloud.com:12345/defaultdb', {}),
    ).toBe('connect failed: [redacted-uri]');
  });

  it('removes bare user:pass@ pairs', () => {
    expect(redact('auth avnadmin:s3cr3tpw@host failed', {})).toBe('auth [redacted]@host failed');
  });

  it('removes key=value secrets', () => {
    expect(redact('bad password=hunter22 here', {})).toBe('bad password=[redacted] here');
  });

  it('removes literal values of secret env vars', () => {
    expect(
      redact('SASL failed for token-abc123xyz', { KAFKA_SASL_PASSWORD: 'token-abc123xyz' }),
    ).toBe('SASL failed for [redacted]');
  });

  it('leaves harmless text alone', () => {
    expect(redact('ECONNREFUSED 10.0.0.1:3306', {})).toBe('ECONNREFUSED 10.0.0.1:3306');
  });
});
