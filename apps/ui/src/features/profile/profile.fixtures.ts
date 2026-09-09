import type { UserProfile } from './api';

export const savedProfile: UserProfile = {
  userId: 'usr_1',
  displayName: 'Amina',
  revision: 4,
  photoAssetId: null,
  introduction: null,
  interests: [],
  spokenLanguages: [],
  professionalLink: null,
  visibility: {
    interests: false,
    spokenLanguages: false,
    professionalLink: false,
  },
};
