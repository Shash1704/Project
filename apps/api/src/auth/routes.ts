import { findUserByEmail, getUser, listDemoUsers, rateLimit, upsertUserByEmail } from '@pulse/db';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { isProd } from '../env';
import { HttpError, h } from '../http-error';
import { publishAnalytics } from '../kafka';
import { checkOtp, emailLoginEnabled, issueOtp } from './otp';
import { SESSION_TTL_SEC, createSession, revokeSession, rotateSession, signAccess } from './tokens';

/** The browser reaches the API through the web app's `/api` proxy, so the cookie is first-party. */
const COOKIE = 'pulse_rt';
const COOKIE_PATH = '/api/auth';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: SESSION_TTL_SEC * 1000,
  });
}

async function signIn(res: Response, userId: string) {
  const { sid, refreshToken } = await createSession(userId);
  setRefreshCookie(res, refreshToken);
  const access = await signAccess(userId, sid);
  void publishAnalytics({ type: 'login', userId, conversationId: null });
  res.json({ accessToken: access.token, expiresAt: access.expiresAt, user: await getUser(userId) });
}

const email = z.string().trim().toLowerCase().email().max(254);

export const authRouter = Router();

authRouter.get(
  '/config',
  h(async (_req, res) => {
    res.json({ emailLogin: emailLoginEnabled() });
  }),
);

authRouter.get(
  '/demo-accounts',
  h(async (_req, res) => {
    const users = await listDemoUsers();
    res.json(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        avatarSeed: u.avatarSeed,
        avatarUrl: u.avatarUrl,
      })),
    );
  }),
);

authRouter.post(
  '/demo',
  h(async (req, res) => {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(req.body);
    if (!(await rateLimit('demo', req.ip ?? 'ip', 30, 600)))
      throw new HttpError(429, 'Too many attempts, try again soon');
    const demo = (await listDemoUsers()).find((u) => u.id === userId);
    if (!demo) throw new HttpError(404, 'Demo account not found');
    await signIn(res, demo.id);
  }),
);

authRouter.post(
  '/otp/request',
  h(async (req, res) => {
    if (!emailLoginEnabled())
      throw new HttpError(503, 'Email sign-in is not configured. Use “Try as judge”.');
    const { email: addr } = z.object({ email }).parse(req.body);
    const ipOk = await rateLimit('otp-ip', req.ip ?? 'ip', 10, 900);
    const mailOk = await rateLimit('otp-mail', addr, 3, 900);
    if (!ipOk || !mailOk)
      throw new HttpError(429, 'Too many codes requested. Try again in a few minutes.');
    await issueOtp(addr);
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/otp/verify',
  h(async (req, res) => {
    const body = z
      .object({
        email,
        code: z.string().regex(/^\d{6}$/),
        name: z.string().trim().min(1).max(80).optional(),
      })
      .parse(req.body);
    if (!(await rateLimit('otp-verify', req.ip ?? 'ip', 20, 900)))
      throw new HttpError(429, 'Too many attempts');
    if (!(await checkOtp(body.email, body.code)))
      throw new HttpError(401, 'That code is wrong or has expired');
    const existing = await findUserByEmail(body.email);
    const user =
      existing ?? (await upsertUserByEmail(body.email, body.name ?? body.email.split('@')[0]!));
    await signIn(res, user.id);
  }),
);

authRouter.post(
  '/refresh',
  h(async (req, res) => {
    const token = req.cookies?.[COOKIE] as string | undefined;
    const rotated = token ? await rotateSession(token) : null;
    if (!rotated) {
      res.clearCookie(COOKIE, { path: COOKIE_PATH });
      throw new HttpError(401, 'Not signed in');
    }
    setRefreshCookie(res, rotated.refreshToken);
    const access = await signAccess(rotated.userId, rotated.sid);
    res.json({
      accessToken: access.token,
      expiresAt: access.expiresAt,
      user: await getUser(rotated.userId),
    });
  }),
);

authRouter.post(
  '/logout',
  h(async (req, res) => {
    const token = req.cookies?.[COOKIE] as string | undefined;
    const sid = token?.split('.')[0];
    if (sid) await revokeSession(sid);
    res.clearCookie(COOKIE, { path: COOKIE_PATH });
    res.json({ ok: true });
  }),
);
