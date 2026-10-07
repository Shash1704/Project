import { createServer } from 'node:http';
import { loadRootEnv } from '@pulse/aiven';

loadRootEnv();

// Env must be loaded before modules that read it at import time.
const { env } = await import('./env');
const { createApp } = await import('./app');
const { createSocketServer } = await import('./socket');
const { disconnectProducer } = await import('./kafka');
const { closeDb, closeValkey } = await import('@pulse/db');

const http = createServer(createApp());
const io = createSocketServer(http);

http.listen(env.API_PORT, () => {
  console.log(`[api] listening on :${env.API_PORT}`);
});

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  io.close();
  await disconnectProducer();
  await Promise.all([closeDb(), closeValkey()]);
  http.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
