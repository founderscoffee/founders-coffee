import { profile } from '@founders-coffee/domain';
import type { Locale } from '@founders-coffee/i18n';

import type { UserProfile } from './api';

export type ProfileDraft = Omit<UserProfile, 'userId' | 'revision'>;

/** Start a draft from the saved profile, so Discard has something exact to restore. */
export const draftFrom = (saved: UserProfile): ProfileDraft => ({
  displayName: saved.displayName,
  photoAssetId: saved.photoAssetId,
  introduction: saved.introduction,
  introductionLocale: saved.introductionLocale,
  communityRole: saved.communityRole,
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
  draft.introductionLocale !== saved.introductionLocale ||
  draft.communityRole !== saved.communityRole ||
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
 * normalizes: it clears an authored language when the introduction empties and withdraws a
 * publication flag whose field is empty, so the command sent is the one the server would have
 * derived anyway, and the preview built from it cannot disagree with what gets stored.
 */
export const commandFrom = (
  draft: ProfileDraft,
  expectedRevision: number,
  fallbackLocale: Locale,
):
  | { ok: true; command: profile.UpdateProfileInput }
  | { ok: false; field: string } => {
  const parsed = profile.updateProfileSchema.safeParse({
    displayName: draft.displayName,
    expectedRevision,
    introduction: draft.introduction,
    introductionLocale: draft.introduction
      ? (draft.introductionLocale ?? fallbackLocale)
      : null,
    communityRole: draft.communityRole,
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

/**
 * Project the draft exactly the way the server projects the saved row.
 *
 * The preview reuses `projectPublicProfile` rather than reimplementing the visibility rules, so the
 * screen physically cannot promise something the API would withhold — the two agree because they
 * are the same function. `expectedRevision` is dropped on the way through because both schemas are
 * strict objects and the owner shape has no such field. Returns null while the draft is not yet
 * valid; the caller keeps showing the last projection instead of blanking the panel over a
 * half-typed URL.
 */
export const previewFrom = (
  draft: ProfileDraft,
  saved: UserProfile,
  fallbackLocale: Locale,
): profile.PublicMemberProfile | null => {
  const built = commandFrom(draft, saved.revision, fallbackLocale);
  if (!built.ok) return null;
  const { expectedRevision: _revision, ...details } = built.command;
  const owner = profile.ownerProfileSchema.safeParse({
    ...details,
    userId: saved.userId,
    photoAssetId: draft.photoAssetId,
    revision: saved.revision,
  });
  return owner.success ? profile.projectPublicProfile(owner.data) : null;
};
