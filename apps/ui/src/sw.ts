/**
 * Service worker — Serwist (InjectManifest mode).
 * Handles precaching (via Serwist) + push notifications (custom handlers).
 *
 * Push payload format (from FCM HTTP v1):
 * {
 *   title: "Host Arrived",
 *   body: "Amine is at Café Tantonville — wearing a black cap",
 *   url: "/dz/e/coffee-meetup-saturday"
 * }
 */

/* eslint-disable-next-line local/no-line-comments -- TypeScript triple-slash directive */
/// <reference lib="webworker" />

import { defaultCache } from '@serwist/vite/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

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
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

/** Push notification handler. */
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let payload: { title: string; body: string; url?: string; icon?: string };
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'founders.coffee',
      body: event.data.text(),
    };
  }

  const options: NotificationOptions & { vibrate?: number[] } = {
    body: payload.body,
    icon: payload.icon ?? '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    data: { url: payload.url ?? '/' },
    vibrate: [200, 100, 200],
    tag: 'founders-coffee-push',
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
