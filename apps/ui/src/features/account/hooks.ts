import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Locale } from '@founders-coffee/i18n';

import { authClient } from '../../lib/auth';
import { accountApi } from './api';

export const useMyAccount = () => {
  const auth = authClient.useSession();
  const userId = auth.data?.user.id;
  const query = useQuery({
    queryKey: ['account', 'summary', userId],
    queryFn: accountApi.getMyAccount,
    enabled: !!userId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  return { ...query, userId, isAuthLoading: auth.isPending };
};

export const useMyDevices = () => {
  const auth = authClient.useSession();
  const userId = auth.data?.user.id;
  return useQuery({
    queryKey: ['account', 'devices', userId],
    queryFn: accountApi.getMyDevices,
    enabled: !!userId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
};

const useDeviceMutation = <TInput, TResult>(
  call: (input: TInput) => Promise<TResult>,
) => {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSuccess: () => void cache.invalidateQueries({ queryKey: ['account'] }),
  });
};

export const useRevokeDevice = () =>
  useDeviceMutation((input: { sessionId?: string; othersOnly?: boolean }) =>
    accountApi.revokeDevice(input),
  );

export const useUnlinkProvider = () =>
  useDeviceMutation((input: { providerId: string }) =>
    accountApi.unlinkProvider(input),
  );

export const useUpdateAccountLocale = () => {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (locale: Locale) => accountApi.updateMyLocale(locale),
    onSuccess: () => void cache.invalidateQueries({ queryKey: ['account'] }),
  });
};
