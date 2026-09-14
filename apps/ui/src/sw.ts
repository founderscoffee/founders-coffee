/// <reference lib="webworker" />

import { defaultCache } from '@serwist/vite/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

import {
  isPrivateProfilePath,
  purgePrivateCacheEntries,
} from './lib/profile-cache';
import { readPushPayload } from './lib/push-payload';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => isPrivateProfilePath(url.pathname),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

self.addEventListener('activate', (event) => {
  event.waitUntil(purgePrivateCacheEntries(caches));
});

/**
 * Push notification handler.
 *
 * The tag is the sending notification's own key, so a redelivered copy replaces the one already on
 * screen instead of stacking. A constant tag would do the opposite of what it looks like: distinct
 * reminders would overwrite each other while duplicates of one still stacked across devices.
 *
 * The envelope is normalised by {@link readPushPayload} rather than read directly, because FCM
 * rewraps what the sender wrote and the shape it arrives in cannot be confirmed until a push is
 * actually delivered.
 */
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let raw: unknown;
  try {
    raw = event.data.json();
  } catch {
    raw = { body: event.data.text() };
  }

  const payload = readPushPayload(raw);

  const options: NotificationOptions & { vibrate?: number[] } = {
    body: payload.body,
    icon: payload.icon,
    badge: '/android-chrome-192x192.png',
    data: { url: payload.url },
    vibrate: [200, 100, 200],
    tag: payload.dedupeKey ?? 'founders-coffee-push',
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

/** Notification click handler — opens the relevant URL. */
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const url = (event.notification.data as { url?: string } | null)?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            await client.focus();
            await client.navigate(url);
            return;
          }
        }
        await self.clients.openWindow(url);
      }),
  );
});
