import { AppError, err, ok, type Result } from '@founders-coffee/core';
import { profile } from '@founders-coffee/domain';
import type { MemberProfileRow } from '@founders-coffee/db';

/** Project storage into the owner contract without carrying identity secrets or residence. */
export const ownerProfileProjection = (
  userId: string,
  displayName: string,
  joinedAt: Date,
  row?: MemberProfileRow | null,
): profile.OwnerProfile =>
  profile.ownerProfileSchema.parse({
    userId,
    displayName,
    photoAssetId: row?.photoAssetId ?? null,
    memberSince: profile.memberSinceOf(joinedAt),
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
      attendedCount: row?.publishAttendedCount ?? false,
    },
  });

/**
 * The owner's profile from the rows `getProfileIdentity` and `getMemberProfile` read, or
 * `not_found` when there is no identity that may be shown.
 */
export const ownerProfileOf = (
  userId: string,
  identity: {
    readonly name: string;
    readonly email: string;
    readonly createdAt: Date;
  } | null,
  stored: { readonly profile: MemberProfileRow } | null,
): Result<profile.OwnerProfile> => {
  if (!identity) return err(new AppError('not_found', 'Profile not found'));
  const name = profile.safeProfileDisplayName(identity.name, identity.email);
  return ok(
    ownerProfileProjection(userId, name, identity.createdAt, stored?.profile),
  );
};

/** A profile's public card with its meetup record, or `not_found` while it has no name to show. */
export const publicProfileOf = (
  owner: profile.OwnerProfile,
  record: profile.MeetupRecord,
): Result<profile.PublicMemberProfile> => {
  if (!owner.displayName)
    return err(new AppError('not_found', 'Profile not found'));
  return ok(
    profile.publicMemberProfileSchema.parse(
      profile.projectPublicProfile(owner, record),
    ),
  );
};

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
  publishAttendedCount: input.visibility.attendedCount,
});
