import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authClient } from '../../lib/auth';
import {
  operationsApi,
  type SubmitCloseoutRequest,
  type SubmitFeedbackRequest,
} from './api';

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

export const useFeedback = (eventId: string) => {
  const auth = authClient.useSession();
  const userId = auth.data?.user.id;
  const query = useQuery({
    queryKey: ['feedback', eventId, userId],
    queryFn: () => operationsApi.getFeedbackView(eventId),
    enabled: !!userId && eventId.length > 0,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  return { ...query, isAuthLoading: auth.isPending, userId };
};

export const useSubmitFeedback = (eventId: string) => {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitFeedbackRequest) =>
      operationsApi.submitFeedback(input),
    onSuccess: () =>
      void cache.invalidateQueries({ queryKey: ['feedback', eventId] }),
  });
};

/**
 * How the attendees found a gathering, for its host.
 *
 * Asked only once the host is looking at a closeout that exists, because there is nothing to
 * summarise before one does and an enabled query would put a refusal in the cache for every past
 * event on the way past. Cached normally rather than `staleTime: 0`: unlike the closeout itself
 * this is not a value the same host is about to write, so a refetch on every mount buys nothing.
 */
export const useFeedbackTally = (eventId: string, enabled: boolean) => {
  const auth = authClient.useSession();
  const userId = auth.data?.user.id;
  return useQuery({
    queryKey: ['feedback-tally', eventId, userId],
    queryFn: () => operationsApi.getFeedbackTally(eventId),
    enabled: enabled && !!userId && eventId.length > 0,
    retry: false,
  });
};
