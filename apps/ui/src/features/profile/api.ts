import {
  getMyProfile,
  getPublicProfile,
  setHomeLocation,
  type PublicProfile,
  type UserProfile,
} from '@founders-coffee/server-fns'

export const profileApi = {
  getMyProfile,
  getPublicProfile,
  setHomeLocation,
}

export type { PublicProfile, UserProfile }
export type SetHomeLocationInput = { data: { marketCode: string; state: string; city: string } }
