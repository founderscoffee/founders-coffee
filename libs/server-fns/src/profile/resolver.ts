import { AppError, err, ok, type Result } from '@founders-coffee/core';
import {
  getMemberProfile,
  getProfileIdentity,
  initializeMemberProfile,
  updateMemberProfile,
  type Db,
} from '@founders-coffee/db';
import { profile } from '@founders-coffee/domain';
import { logger } from '@founders-coffee/observability';

import { ownerProfileProjection, profileChanges } from './projection.js';
import type {
  UpdateDisplayNameRequest,
  UserProfile,
  PublicProfile,
} from './schemas.js';

/** Execute profile I/O with safe telemetry and a typed failure boundary. */
const profileOperation = async <T>(
  operation: string,
  userId: string,
  run: () => Promise<Result<T>>,
): Promise<Result<T>> => {
  logger.info('profile_requested', { operation, userId, scope: 'global' });
  try {
    const result = await run();
    if (!result.ok)
      logger.warn('profile_rejected', {
        operation,
        userId,
        code: result.error.code,
      });
    return result;
  } catch {
    logger.error('profile_failed', { operation, userId, scope: 'global' });
    return err(
      new AppError('profile_unavailable', 'Profile is temporarily unavailable'),
    );
  }
};

/** Read without creating rows; new members get location-free private defaults. */
export const readOwnerProfile = (
  db: Db,
  userId: string,
): Promise<Result<UserProfile>> =>
  profileOperation('read_owner', userId, async () => {
    const [identity, stored] = await Promise.all([
      getProfileIdentity(db, userId),
      getMemberProfile(db, userId),
    ]);
    if (!identity) return err(new AppError('not_found', 'Profile not found'));
    const name = profile.safeProfileDisplayName(identity.name, identity.email);
    return ok(ownerProfileProjection(userId, name, stored?.profile));
  });

/** Anonymous reads are intentionally public but contain only the opt-in field projection. */
export const readPublicProfile = (
  db: Db,
  userId: string,
): Promise<Result<PublicProfile>> =>
  profileOperation('read_public', userId, async () => {
    const result = await readOwnerProfile(db, userId);
    if (!result.ok) return result;
    if (!result.data.displayName)
      return err(new AppError('not_found', 'Profile not found'));
    return ok(
      profile.publicMemberProfileSchema.parse(
        profile.projectPublicProfile(result.data),
      ),
    );
  });

/** Save the validated owner command under a revision without allowing identity field assignment. */
export const saveOwnerProfile = (
  db: Db,
  userId: string,
  input: profile.UpdateProfileInput,
): Promise<Result<UserProfile>> =>
  profileOperation('update', userId, async () => {
    const identity = await getProfileIdentity(db, userId);
    if (!identity) return err(new AppError('not_found', 'Profile not found'));
    if (!profile.safeProfileDisplayName(input.displayName, identity.email)) {
      return err(
        new AppError(
          'validation_failed',
          'Choose a display name, not a contact address',
        ),
      );
    }
    await initializeMemberProfile(db, userId);
    const row = await updateMemberProfile(db, {
      userId,
      displayName: input.displayName,
      expectedRevision: input.expectedRevision,
      changes: profileChanges(input),
    });
    if (!row) {
      if (!(await getProfileIdentity(db, userId)))
        return err(new AppError('not_found', 'Profile is no longer available'));
      return err(
        new AppError(
          'profile_conflict',
          'Profile changed; reload before saving',
        ),
      );
    }
    return ok(ownerProfileProjection(userId, input.displayName, row));
  });

/** Complete or change a name without erasing optional fields saved in the same revision. */
export const saveDisplayName = async (
  db: Db,
  userId: string,
  input: UpdateDisplayNameRequest,
): Promise<Result<UserProfile>> => {
  const current = await readOwnerProfile(db, userId);
  if (!current.ok) return current;
  const value = current.data;
  return saveOwnerProfile(db, userId, {
    displayName: input.displayName,
    expectedRevision: input.expectedRevision,
    introduction: value.introduction,
    interests: value.interests,
    spokenLanguages: value.spokenLanguages,
    professionalLink: value.professionalLink,
    visibility: value.visibility,
  });
};
