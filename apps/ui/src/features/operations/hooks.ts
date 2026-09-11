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
