import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';

import { authClient } from '../../lib/auth';
import { profileApi, type UpdateDisplayNameRequest } from './api';

export const useMyProfile = () => {
  const auth = authClient.useSession();
  const userId = auth.data?.user.id;
  const query = useQuery({
    queryKey: ['profile', 'owner', userId],
    queryFn: profileApi.getMyProfile,
    enabled: !!userId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  return { ...query, userId, isAuthLoading: auth.isPending };
};

export const usePublicProfile = (userId: string) =>
  useQuery({
    queryKey: ['profile', 'public', userId],
    queryFn: () => profileApi.getPublicProfile(userId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

export const useUpdateDisplayName = () => {
  const cache = useQueryClient();
  const router = useRouter();
  const auth = authClient.useSession();
  return useMutation({
    mutationFn: (input: UpdateDisplayNameRequest) =>
      profileApi.updateDisplayName(input),
    onSuccess: (saved) => {
      cache.setQueryData(['profile', 'owner', saved.userId], saved);
      void cache.invalidateQueries({
        queryKey: ['profile', 'public', saved.userId],
      });
      void cache.invalidateQueries({ queryKey: ['events'] });
      void cache.invalidateQueries({ queryKey: ['event'] });
      void auth.refetch();
      void router.invalidate();
    },
  });
};
