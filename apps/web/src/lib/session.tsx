'use client';

import type { UserDto } from '@pulse/shared';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthChange, refresh } from './api';
import { resetChat, startChat } from './store';

const SessionContext = createContext<UserDto | null>(null);
export const useMe = () => useContext(SessionContext);

/** Restores the session from the refresh cookie, starts the realtime connection, or sends to /welcome. */
export function SessionGate({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserDto | null>(null);

  useEffect(() => {
    let alive = true;
    const off = onAuthChange((u) => {
      if (!alive) return;
      setUser(u);
      if (!u) {
        resetChat();
        router.replace('/welcome');
      }
    });
    void refresh().then((r) => {
      if (!alive) return;
      if (!r) router.replace('/welcome');
      else void startChat(r.user);
    });
    return () => {
      alive = false;
      off();
    };
  }, [router]);

  return <SessionContext.Provider value={user}>{user ? children : fallback}</SessionContext.Provider>;
}
