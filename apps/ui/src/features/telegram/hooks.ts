import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { telegramApi } from './api';

const telegramKey = (eventId: string) => ['telegram', eventId] as const;

/**
 * Where the reader stands with a meetup's Telegram group, asked again each time they come back.
 *
 * What changes it happens in Telegram: the host adds the bot there, and a member is let in there. So
 * the page asks again when it is shown after being left, which the app's defaults otherwise stop.
 */
export const useTelegramGroup = (eventId: string) =>
  useQuery({
    queryKey: telegramKey(eventId),
    queryFn: () => telegramApi.getView(eventId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

const useTelegramMutation = <T>(
  eventId: string,
  mutationFn: (eventId: string) => Promise<T>,
) => {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: () => mutationFn(eventId),
    onSettled: () =>
      cache.invalidateQueries({ queryKey: telegramKey(eventId) }),
  });
};

export const useConnectTelegramGroup = (eventId: string) =>
  useTelegramMutation(eventId, telegramApi.connect);

export const useDisconnectTelegramGroup = (eventId: string) =>
  useTelegramMutation(eventId, telegramApi.disconnect);

export const useRequestTelegramInvite = (eventId: string) =>
  useTelegramMutation(eventId, telegramApi.requestInvite);
