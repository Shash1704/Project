import { createServer } from 'node:http';
import { loadRootEnv } from '@pulse/aiven';
import { appEnv, parseEnv } from '@pulse/shared';
import { Server } from 'socket.io';
import { createApp } from './app';

loadRootEnv();
const env = parseEnv(appEnv);

const app = createApp();
const http = createServer(app);
const io = new Server(http, {
  cors: { origin: env.WEB_ORIGIN, credentials: true },
});

io.on('connection', (socket) => {
  socket.emit('hello', { serverTime: Date.now() });
});

http.listen(env.API_PORT, () => {
  console.log(`[api] listening on :${env.API_PORT}`);
});

const shutdown = () => {
  io.close();
  http.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
