/**
 * PWA push client — lazily loaded (via dynamic import from PushPermissionPrompt.onAccept) so the
 * heavy `firebase` SDK never touches the initial bundle. Initializes Firebase Messaging, requests
 * the Notification permission, gets an FCM registration token, and registers it server-side.
 *
 * Lives in `features/push/` (not `lib/`) because it imports `@founders-coffee/server-fns` —
 * `features/` is the api/hooks layer where server-fn calls are allowed (AGENTS.md §4).
 *
 * Gracefully no-ops if Firebase isn't configured (getFirebaseConfig returns null) or push isn't
 * supported (Safari < 16.4, no service worker).
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

import {
  getFirebaseConfig,
  registerPushTokenFn,
} from '@founders-coffee/server-fns';

let app: FirebaseApp | null = null;

const ensureMessaging = async () => {
  if (app) return getMessaging(app);
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  if (!(await isSupported())) return null;

  const config = await getFirebaseConfig();
  if (!config) return null;

  app = initializeApp(config);
  return getMessaging(app);
};

/**
 * Request push permission + register the FCM token. Called from the PushPermissionPrompt onAccept
 * callback. No-ops silently if push isn't available/configured.
 */
export const requestPushPermission = async (
  marketCode: string,
): Promise<void> => {
  try {
    const messaging = await ensureMessaging();
    if (!messaging) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const config = await getFirebaseConfig();
    if (!config) return;

    const token = await getToken(messaging, { vapidKey: config.vapidKey });
    if (!token) return;

    await registerPushTokenFn({
      data: { token, platform: 'web', surface: 'pwa', marketCode },
    });
  } catch {
    /* push is best-effort — never block the user flow on a push failure */
  }
};
