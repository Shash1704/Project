import type { RequestHandler } from 'express';
import { HttpError } from '../http-error';
import { sessionAlive, verifyAccess } from './tokens';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express's documented augmentation point
  namespace Express {
    interface Request {
      userId: string;
      sid: string;
    }
  }
}

/** Bearer access token + live session check (sessions are revocable via Valkey). */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next(new HttpError(401, 'Not signed in'));
  verifyAccess(token)
    .then(async (c) => {
      if (!(await sessionAlive(c.sid))) throw new Error('revoked');
      req.userId = c.sub;
      req.sid = c.sid;
      next();
    })
    .catch(() => next(new HttpError(401, 'Session expired')));
};
