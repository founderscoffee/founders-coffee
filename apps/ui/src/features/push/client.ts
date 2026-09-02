import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

import { readPushConfig, registerPushToken } from './api';

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

    const config = await readPushConfig();
    if (!config) return;

    const token = await getToken(messaging, { vapidKey: config.vapidKey });
    if (!token) return;

    await registerPushToken({ token, marketCode });
  } catch {
    return;
  }
};
