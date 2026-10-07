import { loadRootEnv } from '@pulse/aiven';
import { ALL_TOPICS } from '@pulse/shared';

loadRootEnv();

console.log(`[worker] booted; will consume: ${ALL_TOPICS.join(', ')}`);

// Keep the process alive until consumers are registered in Phase 1.
const keepAlive = setInterval(() => {}, 1 << 30);
const shutdown = () => {
  clearInterval(keepAlive);
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
