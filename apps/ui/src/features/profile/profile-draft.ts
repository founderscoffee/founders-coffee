import { profile } from '@founders-coffee/domain';

import type { UserProfile } from './api';

export type ProfileDraft = Omit<UserProfile, 'userId' | 'revision'>;

/** Start a draft from the saved profile, so Discard has something exact to restore. */
export const draftFrom = (saved: UserProfile): ProfileDraft => ({
  displayName: saved.displayName,
  photoAssetId: saved.photoAssetId,
  introduction: saved.introduction,
  interests: [...saved.interests],
  spokenLanguages: [...saved.spokenLanguages],
  professionalLink: saved.professionalLink,
  visibility: { ...saved.visibility },
});

/**
 * Whether the draft still says what the saved profile says.
 *
 * Compared field by field rather than by reference or JSON, because the arrays are rebuilt on every
 * chip toggle and a reference check would call an untouched profile dirty the moment anything
 * re-rendered. Order matters for the arrays only in that the UI never reorders them; a member who
 * removes a topic and adds it back lands on a different order and is correctly told they have a
 * change to save, which is honest — the server stores what it is given.
 */
export const isDraftDirty = (
  draft: ProfileDraft,
  saved: UserProfile,
): boolean =>
  draft.displayName.trim() !== saved.displayName.trim() ||
  draft.introduction !== saved.introduction ||
  draft.professionalLink !== saved.professionalLink ||
  draft.interests.join() !== saved.interests.join() ||
  draft.spokenLanguages.join() !== saved.spokenLanguages.join() ||
  (Object.keys(draft.visibility) as (keyof ProfileDraft['visibility'])[]).some(
    (field) => draft.visibility[field] !== saved.visibility[field],
  );

/**
 * Build the command the server accepts, or report why it cannot be built yet.
 *
 * The draft is edited freely — an over-long introduction or a half-typed URL is a normal state to
 * be in — so validation happens here rather than blocking keystrokes. `updateProfileSchema` also
 * normalizes: it normalizes empty fields and withdraws a
 * publication flag whose field is empty, so the command sent is the one the server would have
 * derived anyway, and the preview built from it cannot disagree with what gets stored.
 */
export const commandFrom = (
  draft: ProfileDraft,
  expectedRevision: number,
):
  | { ok: true; command: profile.UpdateProfileInput }
  | { ok: false; field: string } => {
  const parsed = profile.updateProfileSchema.safeParse({
    displayName: draft.displayName,
    expectedRevision,
    introduction: draft.introduction,
    interests: draft.interests,
    spokenLanguages: draft.spokenLanguages,
    professionalLink: draft.professionalLink,
    visibility: draft.visibility,
  });
  return parsed.success
    ? { ok: true, command: parsed.data }
    : {
        ok: false,
        field: String(parsed.error.issues[0]?.path[0] ?? 'profile'),
      };
};
