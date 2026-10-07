import { errorMessage } from '@pulse/aiven';
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Not found') => new HttpError(404, what);
export const forbidden = (what = 'Forbidden') => new HttpError(403, what);

/** Wrap an async handler so rejections reach the error middleware. */
export const h =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res
      .status(400)
      .json({
        error: 'Invalid request',
        issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
      });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(`[api] ${errorMessage(err)}`);
  res.status(500).json({ error: 'Something went wrong' });
};
