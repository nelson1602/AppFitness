// Tiny hash router: `#/path?query`. No library on purpose.

import { useSyncExternalStore } from 'react';

export interface Route {
  /** Path segments, e.g. `#/usuarios/abc` → ['usuarios', 'abc']. */
  segments: string[];
  query: URLSearchParams;
}

export const paths = {
  login: '/login',
  invite: '/invitacion',
  dashboard: '/panel',
  users: '/usuarios',
  user: (userId: string) => `/usuarios/${encodeURIComponent(userId)}`,
  staff: '/personal',
  roles: '/roles',
  audit: '/auditoria',
} as const;

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const [pathPart = '', queryPart = ''] = raw.split('?', 2);
  const segments = pathPart
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  return { segments, query: new URLSearchParams(queryPart) };
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function getHash(): string {
  return window.location.hash;
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, getHash, getHash);
}

export function navigate(path: string): void {
  const target = `#${path}`;
  if (window.location.hash === target) return;
  window.location.hash = path;
}

export function href(path: string): string {
  return `#${path}`;
}
