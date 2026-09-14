import { Serwist } from '@serwist/window';

let pending: Promise<ServiceWorkerRegistration | null> | null = null;

type RegisterServiceWorkerOptions = {
  onRegistrationError?: (error: unknown) => void;
};

/**
 * Whether this build has a service worker to register at all.
 *
 * `@serwist/vite` is disabled under `vite serve`, so `/sw.js` does not exist in development and
 * registering it would 404 on every page load. The check is on the build mode rather than on a
 * fetch, because a missing worker in production is a defect that must be visible and a missing
 * worker in development is the expected state.
 */
const isAvailable = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  import.meta.env.PROD;

/**
 * Register the app's service worker, once per page.
 *
 * Memoised on the promise rather than the result, so the root layout's effect and a later push
 * enablement share one registration instead of racing two. Both need the same object: the layout
 * wants the worker running for offline caching, and FCM needs the registration handed to
 * `getToken`, which otherwise goes looking for a `firebase-messaging-sw.js` this app deliberately
 * does not have.
 *
 * Resolves to `null` rather than throwing. A browser that refuses the registration — private mode,
 * storage blocked, an unsupported context — is a state the caller has to render, not an exception
 * to propagate through a layout effect. Callers can provide an error callback when the failure
 * needs to be reported.
 */
export const registerServiceWorker = (
  options: RegisterServiceWorkerOptions = {},
): Promise<ServiceWorkerRegistration | null> => {
  if (!isAvailable()) return Promise.resolve(null);
  if (pending) return pending;

  pending = new Serwist('/sw.js', { scope: '/', type: 'classic' })
    .register()
    .then((registration) => registration ?? null)
    .catch((error: unknown) => {
      options.onRegistrationError?.(error);
      pending = null;
      return null;
    });

  return pending;
};
