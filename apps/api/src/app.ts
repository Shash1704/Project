import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { authRouter } from './auth/routes';
import { aiRouter } from './routes/ai';
import { statsRouter } from './routes/stats';
import { errorHandler } from './http-error';
import { conversationsRouter } from './routes/conversations';
import { usersRouter } from './routes/users';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'api', uptime: Math.round(process.uptime()) });
  });

  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/conversations', conversationsRouter);
  app.use('/ai', aiRouter);
  app.use('/stats', statsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);
  return app;
}
