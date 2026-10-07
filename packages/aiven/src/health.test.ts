import { describe, expect, it } from 'vitest';
import { checks, runChecks } from './health';

describe('runChecks', () => {
  it('reports every service and never throws', async () => {
    const results = await runChecks([
      { name: 'good', run: async () => 'fine' },
      { name: 'bad', run: async () => Promise.reject(new Error('boom rediss://u:p@h:1')) },
    ]);
    expect(results).toEqual([
      expect.objectContaining({ name: 'good', ok: true, detail: 'fine' }),
      expect.objectContaining({ name: 'bad', ok: false, detail: 'boom [redacted-uri]' }),
    ]);
  });

  it('checks all five Aiven services', () => {
    expect(checks.map((c) => c.name)).toEqual([
      'MySQL',
      'PostgreSQL',
      'Kafka',
      'Valkey',
      'OpenSearch',
    ]);
  });
});
