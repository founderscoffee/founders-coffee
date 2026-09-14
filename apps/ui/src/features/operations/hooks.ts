import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authClient } from '../../lib/auth';
import { operationsApi } from './api';
import type { SubmitCloseoutRequest } from '@founders-coffee/server-fns';

export const useCloseout = (eventId: string) => {
  const auth = authClient.useSession();
  const userId = auth.data?.user.id;
  const query = useQuery({
    queryKey: ['closeout', eventId, userId],
    queryFn: () => operationsApi.getCloseoutView(eventId),
    enabled: !!userId && eventId.length > 0,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  return { ...query, isAuthLoading: auth.isPending, userId };
};

/**
 * The closeout state of the caller's own past gatherings, keyed by the ids asked about.
 *
 * Separate from the hosted list rather than folded into it: that list is the public profile's query
 * too, and a host's admission that a gathering did not happen is not a public fact. Disabled when
 * there is nothing to ask about, so an empty activity page makes no request at all.
 */
export const useMyCloseoutStates = (eventIds: readonly string[]) => {
  const auth = authClient.useSession();
  const userId = auth.data?.user.id;
  const key = [...eventIds].sort().join(',');
  return useQuery({
    queryKey: ['closeout-states', userId, key],
    queryFn: () => operationsApi.getMyCloseoutStates(eventIds),
    enabled: !!userId && eventIds.length > 0,
    retry: false,
  });
};

export const useSubmitCloseout = (eventId: string) => {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitCloseoutRequest) =>
      operationsApi.submitCloseout(input),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['closeout', eventId] });
    },
  });
};
