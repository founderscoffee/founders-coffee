import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

import { readPushConfig, registerPushToken } from './api';
import { logServiceWorkerFailure } from './service-worker-error';
import { registerServiceWorker } from './service-worker';

let app: FirebaseApp | null = null;

const ensureMessaging = async () => {
  if (app) return getMessaging(app);
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  if (!(await isSupported())) return null;

  const config = await readPushConfig();
  if (!config) return null;

  app = initializeApp(config);
  return getMessaging(app);
};

/**
 * Mint this device's FCM token against the app's own service worker.
 *
 * `getToken` registers `/firebase-messaging-sw.js` when it is not handed a registration, and this
 * app has no such file on purpose: `src/sw.ts` already owns `push` and `notificationclick`, and a
 * second worker competing for the same event is how a notification arrives twice or not at all.
 * Passing the registration is therefore not an optimisation — without it the SDK looks for a file
 * that returns the SPA's HTML, and registration fails with an opaque error.
 *
 * No worker, no token. Returning `null` here keeps the refusal in one place rather than letting the
 * SDK fail somewhere less legible.
 */
const tokenFor = async (): Promise<string | null> => {
  const messaging = await ensureMessaging();
  if (!messaging) return null;
  const config = await readPushConfig();
  if (!config) return null;
  const serviceWorkerRegistration = await registerServiceWorker({
    onRegistrationError: logServiceWorkerFailure,
  });
  if (!serviceWorkerRegistration) return null;
  return (
    (await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration,
    })) || null
  );
};

/**
 * What this browser can and cannot do about push, asked rather than assumed.
 *
 * Each field is a separate question because the preferences screen has to explain a different
 * obstacle for each answer, and because they fail independently: a browser can support messaging
 * while the site has no configuration, and permission can be granted on a device the deployment
 * cannot reach. Returning one boolean would force the screen to guess which.
 *
 * Nothing here prompts. Reading the state must never be the thing that asks a member for
 * permission — the spec requires a user gesture, and a settings page that prompts on load is
 * exactly the pattern browsers now punish with a permanent block.
 */
export const readPushEnvironment = async (): Promise<{
  hasNotificationApi: boolean;
  messagingSupported: boolean;
  configured: boolean;
  permission: 'default' | 'granted' | 'denied';
}> => {
  const hasNotificationApi =
    typeof window !== 'undefined' && 'Notification' in window;
  if (!hasNotificationApi)
    return {
      hasNotificationApi: false,
      messagingSupported: false,
      configured: false,
      permission: 'default',
    };

  const messagingSupported = await isSupported().catch(() => false);
  const configured = messagingSupported ? !!(await readPushConfig()) : false;
  return {
    hasNotificationApi,
    messagingSupported,
    configured,
    permission: Notification.permission,
  };
};

/**
 * The token for this device, when there is one to have.
 *
 * Only called with permission already granted: `getToken` prompts otherwise, and a settings screen
 * that prompts while merely reporting its own state is the thing `readPushEnvironment` exists to
 * avoid.
 */
export const currentDeviceToken = async (): Promise<string | null> => {
  try {
    if (typeof window === 'undefined' || !('Notification' in window))
      return null;
    if (Notification.permission !== 'granted') return null;
    return await tokenFor();
  } catch {
    return null;
  }
};

/**
 * Ask for permission and register the device, returning the token if both succeeded.
 *
 * Called from a user gesture — the RSVP prompt's accept, or the preferences row's own control.
 * Returns `null` for every reason it did not happen, because the caller's next move is the same in
 * all of them: re-read the state and say what is now true.
 */
export const enablePushOnThisDevice = async (
  marketCode: string,
): Promise<string | null> => {
  try {
    const messaging = await ensureMessaging();
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await tokenFor();
    if (!token) return null;

    await registerPushToken({ token, marketCode });
    return token;
  } catch {
    return null;
  }
};

/**
 * Request push permission + register the FCM token. Called from the PushPermissionPrompt onAccept
 * callback. No-ops silently if push isn't available/configured.
 */
export const requestPushPermission = async (
  marketCode: string,
): Promise<void> => {
  await enablePushOnThisDevice(marketCode);
};
