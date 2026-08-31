import { useMutation, useQuery } from '@tanstack/react-query';

import { profileApi, type SetHomeLocationInput } from './api';

export const useMyProfile = () =>
  useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => profileApi.getMyProfile(),
  });

export const usePublicProfile = (userId: string) =>
  useQuery({
    queryKey: ['profile', 'public', userId],
    queryFn: () => profileApi.getPublicProfile({ data: { userId } }),
  });

export const useUpdateProfile = () =>
  useMutation({
    mutationFn: (input: SetHomeLocationInput) =>
      profileApi.setHomeLocation(input),
  });
