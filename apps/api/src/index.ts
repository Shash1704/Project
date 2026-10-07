import { createServer } from 'node:http';
import { loadRootEnv } from '@pulse/aiven';

loadRootEnv();

// Env must be loaded before modules that read it at import time.
const { env } = await import('./env');
const { createApp } = await import('./app');
const { createSocketServer } = await import('./socket');
const { disconnectProducer, warmProducer } = await import('./kafka');
const { closeDb, closeValkey } = await import('@pulse/db');

warmProducer();
const http = createServer(createApp());
// Hosts like Render inject PORT; fall back to API_PORT locally.
const port = Number(process.env.PORT) || env.API_PORT;
const io = createSocketServer(http);

http.listen(port, () => {
  console.log(`[api] listening on :${port}`);
});

// Free-tier hosts sleep idle services: keep the worker (and anything else listed) warm.
const keepWarm = (process.env.KEEP_WARM_URLS ?? '')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);
if (keepWarm.length) {
  setInterval(() => {
    for (const u of keepWarm) void fetch(u).catch(() => {});
  }, 10 * 60_000).unref();
}

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
