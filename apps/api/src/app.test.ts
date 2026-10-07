import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('api', () => {
  it('GET /healthz reports ok', async () => {
    const res = await request(createApp()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, service: 'api' });
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
