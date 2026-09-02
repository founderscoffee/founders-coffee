import { createServerFn } from '@tanstack/react-start';

import { workerEnv } from './env.js';

import { requireEnv } from '@founders-coffee/core';

/**
 * Public app config for the client. `getMapboxToken` exposes the public Mapbox token (safe to
 * expose — Mapbox tokens are designed for client-side use; it lives in the page anyway). Mirrors the
 * `getPublicAuthConfig` public-config-to-client pattern: `cloudflare:workers` is imported inside the
 * handler, so TanStack's createServerFn split drops it from the browser bundle.
 */
export const getMapboxToken = createServerFn({ strict: false }).handler(
  async () =>
    requireEnv(
      workerEnv() as unknown as Record<string, string | undefined>,
      'MAPBOX_TOKEN',
    ),
);

/**
 * Public Firebase web config + VAPID key for the PWA push client. All these values are designed to
 * be public (Firebase web config + VAPID application-server key). Returns `null` if Firebase isn't
 * configured — the client skips push gracefully.
 */
export const getFirebaseConfig = createServerFn({ strict: false }).handler(
  async () => {
    const e = workerEnv();
    if (!e.FIREBASE_API_KEY || !e.FIREBASE_PROJECT_ID || !e.FIREBASE_VAPID_KEY)
      return null;
    return {
      apiKey: e.FIREBASE_API_KEY,
      authDomain: `${e.FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: e.FIREBASE_PROJECT_ID,
      messagingSenderId: e.FIREBASE_MESSAGING_SENDER_ID ?? '',
      appId: e.FIREBASE_APP_ID ?? '',
      vapidKey: e.FIREBASE_VAPID_KEY,
    };
  },
);
