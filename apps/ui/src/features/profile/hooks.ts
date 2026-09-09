import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';

import { AppError } from '@founders-coffee/core';

import { authClient } from '../../lib/auth';
import { putProfilePhoto } from './photo-upload';
import {
  profileApi,
  type UpdateDisplayNameRequest,
  type UpdateProfileRequest,
} from './api';

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

const useProfileMutation = <TInput>(
  mutationFn: (input: TInput) => ReturnType<typeof profileApi.updateProfile>,
) => {
  const cache = useQueryClient();
  const router = useRouter();
  const auth = authClient.useSession();
  return useMutation({
    mutationFn,
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

export const useUpdateDisplayName = () =>
  useProfileMutation((input: UpdateDisplayNameRequest) =>
    profileApi.updateDisplayName(input),
  );

export const useUpdateProfile = () =>
  useProfileMutation((input: UpdateProfileRequest) =>
    profileApi.updateProfile(input),
  );

export const usePhotoUploadAvailability = () =>
  useQuery({
    queryKey: ['profile', 'photo-availability'],
    queryFn: profileApi.photoAvailability,
    staleTime: 5 * 60_000,
    retry: false,
  });

/**
 * Reserve a key, send the bytes, then re-read the profile the server now owns.
 *
 * Every step is the server's answer rather than an optimistic guess: the asset id comes from the
 * reservation, the acceptance comes from the upload, and the profile is refetched instead of
 * patched locally, because normalization means the stored photo is not the file that was chosen.
 * A failure leaves the previous photo exactly where it was.
 */
export const usePhotoUpload = () => {
  const cache = useQueryClient();
  const auth = authClient.useSession();
  const userId = auth.data?.user.id;
  return useMutation({
    mutationFn: async (input: { file: Blob; turnstileToken?: string }) => {
      const { assetId } = await profileApi.reservePhoto(input.turnstileToken);
      const sent = await putProfilePhoto(assetId, input.file);
      if (!sent.ok) throw new AppError(sent.error.code, 'Photo upload failed');
      return assetId;
    },
    onSuccess: () => {
      if (userId)
        void cache.invalidateQueries({
          queryKey: ['profile', 'owner', userId],
        });
    },
  });
};

export const useRemovePhoto = () => {
  const cache = useQueryClient();
  const auth = authClient.useSession();
  const userId = auth.data?.user.id;
  return useMutation({
    mutationFn: (turnstileToken?: string) =>
      profileApi.removePhoto(turnstileToken),
    onSuccess: () => {
      if (userId)
        void cache.invalidateQueries({
          queryKey: ['profile', 'owner', userId],
        });
    },
  });
};
