import { profile } from '@founders-coffee/domain';
import type { MemberProfileRow } from '@founders-coffee/db';

/** Project storage into the owner contract without carrying identity secrets or residence. */
export const ownerProfileProjection = (
  userId: string,
  displayName: string,
  row?: MemberProfileRow | null,
): profile.OwnerProfile =>
  profile.ownerProfileSchema.parse({
    userId,
    displayName,
    photoAssetId: row?.photoAssetId ?? null,
    revision: row?.revision ?? 0,
    introduction: row?.introduction ?? null,
    introductionLocale: row?.introductionLocale ?? null,
    communityRole: row?.communityRole ?? null,
    interests: row?.interests ?? [],
    spokenLanguages: row?.spokenLanguages ?? [],
    professionalLink: row?.professionalLink ?? null,
    visibility: {
      photo: row?.publishPhoto ?? false,
      introduction: row?.publishIntroduction ?? false,
      communityRole: row?.publishCommunityRole ?? false,
      interests: row?.publishInterests ?? false,
      spokenLanguages: row?.publishSpokenLanguages ?? false,
      professionalLink: row?.publishProfessionalLink ?? false,
    },
  });

/** Explicitly map validated editable fields to storage; ownership and revision are server-owned. */
export const profileChanges = (input: profile.UpdateProfileInput) => ({
  introduction: input.introduction,
  introductionLocale: input.introductionLocale,
  communityRole: input.communityRole,
  interests: input.interests,
  spokenLanguages: input.spokenLanguages,
  professionalLink: input.professionalLink,
  publishPhoto: input.visibility.photo,
  publishIntroduction: input.visibility.introduction,
  publishCommunityRole: input.visibility.communityRole,
  publishInterests: input.visibility.interests,
  publishSpokenLanguages: input.visibility.spokenLanguages,
  publishProfessionalLink: input.visibility.professionalLink,
});
