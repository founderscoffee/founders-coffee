import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authClient } from '../../lib/auth';
import {
  currentDeviceToken,
  enablePushOnThisDevice,
  readPushEnvironment,
} from '../push/client';
import { preferencesApi, type PreferencesInput } from './api';
import {
  installRequiredFor,
  pushStateFrom,
  type PushState,
} from './push-state';

export const useMyPreferences = () => {
  const auth = authClient.useSession();
  const userId = auth.data?.user.id;
  const query = useQuery({
    queryKey: ['preferences', userId],
    queryFn: preferencesApi.getMyPreferences,
    enabled: !!userId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  return { ...query, userId, isAuthLoading: auth.isPending };
};

export const useSavePreferences = () => {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: PreferencesInput) =>
      preferencesApi.updateMyPreferences(input),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['preferences'] });
      void cache.invalidateQueries({ queryKey: ['account'] });
    },
  });
};

/**
 * What this device's push state is, re-asked whenever something could have changed it.
 *
 * The state is assembled in the browser and finished on the server, because the two halves know
 * different things: the browser owns permission and support, and only the server can say whether
 * the token it was given is still attached to a live session. Neither half is sufficient, and a
 * screen built on either alone would misreport a device that was signed out elsewhere.
 *
 * Nothing here prompts on mount. `enable` is the only path that asks, and it is wired to a button.
 */
export const useDevicePushState = (marketCode: string) => {
  const [state, setState] = useState<PushState>('checking');
  const [isEnabling, setIsEnabling] = useState(false);

  const refresh = useCallback(async () => {
    const env = await readPushEnvironment();
    const installRequired =
      typeof window === 'undefined'
        ? false
        : installRequiredFor(
            window.navigator.userAgent,
            window.matchMedia('(display-mode: standalone)').matches,
          );

    const blocked = pushStateFrom({
      ...env,
      installRequired,
      registration: null,
    });
    if (blocked !== 'checking') {
      setState(blocked);
      return;
    }

    const token = await currentDeviceToken();
    const registration = token
      ? await preferencesApi.getPushDeliveryState(token).catch(() => null)
      : { registered: false, deliverable: false };
    setState(pushStateFrom({ ...env, installRequired, registration }));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setIsEnabling(true);
    try {
      await enablePushOnThisDevice(marketCode);
      await refresh();
    } finally {
      setIsEnabling(false);
    }
  }, [marketCode, refresh]);

  return { state, enable, isEnabling, refresh };
};
