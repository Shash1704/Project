import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { signAccess, verifyAccess } from './auth/tokens';

const app = createApp();

describe('api', () => {
  it('GET /healthz reports ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, service: 'api' });
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('rejects protected routes without a token', async () => {
    const res = await request(app).get('/conversations');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Not signed in' });
  });

  it('rejects a forged token', async () => {
    const res = await request(app).get('/users/me').set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('validates auth payloads with zod before touching any service', async () => {
    const res = await request(app).post('/auth/otp/verify').send({ email: 'x@y.z', code: '12' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  });
});

describe('access tokens', () => {
  it('round-trips subject and session id', async () => {
    const { token, expiresAt } = await signAccess(
      '01J00000000000000000000000',
      '01J00000000000000000000001',
    );
    expect(expiresAt).toBeGreaterThan(Date.now());
    await expect(verifyAccess(token)).resolves.toEqual({
      sub: '01J00000000000000000000000',
      sid: '01J00000000000000000000001',
    });
  });

  it('rejects a tampered token', async () => {
    const { token } = await signAccess('01J00000000000000000000000', 'sid');
    const [h, p, s] = token.split('.');
    const tampered = [
      h,
      Buffer.from(JSON.stringify({ sub: 'someone-else', sid: 'sid' })).toString('base64url'),
      s,
    ].join('.');
    expect(p).toBeTruthy();
    await expect(verifyAccess(tampered)).rejects.toThrow();
  });
});
