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
    headline: row?.headline ?? null,
    stage: row?.stage ?? null,
    introduction: row?.introduction ?? null,
    interests: row?.interests ?? [],
    spokenLanguages: row?.spokenLanguages ?? [],
    professionalLink: row?.professionalLink ?? null,
    visibility: {
      headline: row?.publishHeadline ?? false,
      stage: row?.publishStage ?? false,
      interests: row?.publishInterests ?? false,
      spokenLanguages: row?.publishSpokenLanguages ?? false,
      professionalLink: row?.publishProfessionalLink ?? false,
    },
  });

/** Explicitly map validated editable fields to storage; ownership and revision are server-owned. */
export const profileChanges = (input: profile.UpdateProfileInput) => ({
  headline: input.headline,
  stage: input.stage,
  introduction: input.introduction,
  interests: input.interests,
  spokenLanguages: input.spokenLanguages,
  professionalLink: input.professionalLink,
  publishHeadline: input.visibility.headline,
  publishStage: input.visibility.stage,
  publishInterests: input.visibility.interests,
  publishSpokenLanguages: input.visibility.spokenLanguages,
  publishProfessionalLink: input.visibility.professionalLink,
});
