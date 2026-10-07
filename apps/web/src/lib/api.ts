'use client';

import type { UserDto } from '@pulse/shared';

/**
 * REST client. Calls go to `/api/*` on this origin (proxied to the API), so the httpOnly refresh cookie
 * is first-party. The short-lived access token lives only in memory.
 */
let accessToken: string | null = null;
let expiresAt = 0;
let refreshing: Promise<AuthResult | null> | null = null;
const listeners = new Set<(u: UserDto | null) => void>();

export interface AuthResult {
  accessToken: string;
  expiresAt: number;
  user: UserDto;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function onAuthChange(fn: (u: UserDto | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function acceptAuth(r: AuthResult): UserDto {
  accessToken = r.accessToken;
  expiresAt = r.expiresAt;
  listeners.forEach((l) => l(r.user));
  return r.user;
}

function clearAuth() {
  accessToken = null;
  expiresAt = 0;
  listeners.forEach((l) => l(null));
}

/** Single-flight refresh using the httpOnly cookie. Resolves null when signed out. */
export function refresh(): Promise<AuthResult | null> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then(async (res) => {
      if (!res.ok) {
        clearAuth();
        return null;
      }
      const r = (await res.json()) as AuthResult;
      acceptAuth(r);
      return r;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** A valid access token, refreshing ~1 minute before expiry. */
export async function getToken(): Promise<string | null> {
  if (accessToken && Date.now() < expiresAt - 60_000) return accessToken;
  return (await refresh())?.accessToken ?? null;
}

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const doFetch = async (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.json !== undefined) headers.set('Content-Type', 'application/json');
    return fetch(`/api${path}`, {
      ...init,
      headers,
      credentials: 'same-origin',
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });
  };

  let res = await doFetch(path.startsWith('/auth/') ? null : await getToken());
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const r = await refresh();
    if (r) res = await doFetch(r.accessToken);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
  clearAuth();
}
