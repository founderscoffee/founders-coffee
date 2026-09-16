import {
  getMyProfile,
  getPhotoUploadAvailability,
  getPublicProfile,
  removeMyPhoto,
  reserveMyPhotoUpload,
  updateMyDisplayName,
  updateMyProfile,
} from '@founders-coffee/server-fns';
import type {
  PublicProfile,
  UserProfile,
  UpdateDisplayNameRequest,
  UpdateProfileRequest,
} from '@founders-coffee/server-fns';

export const profileApi = {
  getMyProfile: (): Promise<UserProfile> => getMyProfile({ data: {} }),
  getPublicProfile: (userId: string): Promise<PublicProfile> =>
    getPublicProfile({ data: { userId } }),
  updateDisplayName: (data: UpdateDisplayNameRequest): Promise<UserProfile> =>
    updateMyDisplayName({ data }),
  updateProfile: (data: UpdateProfileRequest): Promise<UserProfile> =>
    updateMyProfile({ data }),
  photoAvailability: (): Promise<{ enabled: boolean }> =>
    getPhotoUploadAvailability(),
  reservePhoto: (): Promise<{ assetId: string }> =>
    reserveMyPhotoUpload({ data: {} }),
  removePhoto: (): Promise<{ removedAssetId: string | null }> =>
    removeMyPhoto({ data: {} }),
};
export type {
  PublicProfile,
  UserProfile,
  UpdateDisplayNameRequest,
  UpdateProfileRequest,
};
