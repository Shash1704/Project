import type { ClientToServer, ServerToClient } from '@pulse/shared';
import type { Server } from 'socket.io';

/** Lets REST handlers reach the Socket.IO server without a circular import. */
let server: Server<ClientToServer, ServerToClient> | undefined;
export const setIo = (s: Server<ClientToServer, ServerToClient>) => {
  server = s;
};
export const io = () => server;
