import { errorMessage, loadRootEnv } from '@pulse/aiven';

loadRootEnv();

const { closeDb, closeValkey } = await import('@pulse/db');
const { stopConsumers } = await import('./kafka');
const { startFanout } = await import('./consumers/fanout');
const { startDbWriter } = await import('./consumers/db-writer');
const { startReceipts } = await import('./consumers/receipts');
const { startPresence } = await import('./consumers/presence');
const { startHealthServer } = await import('./health');

startHealthServer();

try {
  await Promise.all([startFanout(), startDbWriter(), startReceipts(), startPresence()]);
  console.log('[worker] all consumers running');
} catch (e) {
  console.error(`[worker] failed to start: ${errorMessage(e)}`);
  process.exit(1);
}

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  await stopConsumers();
  await Promise.all([closeDb(), closeValkey()]);
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
