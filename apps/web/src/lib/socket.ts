'use client';

import type { ClientToServer, ServerToClient } from '@pulse/shared';
import { io, type Socket } from 'socket.io-client';
import { getToken, refresh } from './api';

export type PulseSocket = Socket<ServerToClient, ClientToServer>;

let socket: PulseSocket | null = null;

/** One socket per tab. `auth` is a callback so every (re)connect presents a fresh access token. */
export function getSocket(): PulseSocket {
  if (socket) return socket;
  // Default to the API on the same host the page was opened from (works for LAN devices in dev).
  const url = process.env.NEXT_PUBLIC_API_URL ?? `${location.protocol}//${location.hostname}:4100`;
  socket = io(url, {
    transports: ['websocket'],
    withCredentials: true,
    autoConnect: false,
    auth: (cb) => {
      void getToken().then((token) => cb({ token }));
    },
  });
  socket.on('connect_error', (err) => {
    if (err.message === 'unauthorized') {
      // Access token expired between checks: refresh once, then let socket.io retry.
      void refresh().then((r) => {
        if (r) socket?.connect();
      });
    }
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
