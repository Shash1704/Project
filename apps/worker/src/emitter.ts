import { valkey } from '@pulse/db';
import type { ServerToClient } from '@pulse/shared';
import { Emitter } from '@socket.io/redis-emitter';

let emitter: Emitter<ServerToClient> | undefined;

/** Publishes Socket.IO events through Valkey; every API instance's adapter delivers them. */
export function sockets(): Emitter<ServerToClient> {
  if (!emitter) {
    const client = valkey().duplicate();
    client.on('error', () => {});
    emitter = new Emitter<ServerToClient>(client);
  }
  return emitter;
}
