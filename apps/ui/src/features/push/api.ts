import {
  getFirebaseConfig,
  registerPushTokenFn,
  removePushTokenFn,
} from '@founders-coffee/server-fns';

export interface PushClientConfig {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly messagingSenderId: string;
  readonly appId: string;
  readonly vapidKey: string;
}

/**
 * The push feature's only door to `libs/server-fns` (AGENTS.md §3, §4).
 *
 * `client.ts` reached past this layer and imported the server functions directly, which the
 * boundary rule could not see because it only inspected `components/` and `lib/`. Keeping the
 * imports here means the rule now guards the one module that is allowed to hold them.
 */
export const readPushConfig = async (): Promise<PushClientConfig | null> =>
  (await getFirebaseConfig()) as PushClientConfig | null;

export const registerPushToken = async (input: {
  token: string;
  marketCode: string;
}): Promise<void> => {
  await registerPushTokenFn({
    data: {
      token: input.token,
      platform: 'web',
      surface: 'pwa',
      marketCode: input.marketCode,
    },
  });
};

export const removePushToken = async (token: string): Promise<void> => {
  await removePushTokenFn({ data: { token } });
};
