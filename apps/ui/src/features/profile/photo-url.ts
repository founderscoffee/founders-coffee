export type PhotoVariant = 'md' | 'sm';

/**
 * Where to fetch one variant of a member's photo.
 *
 * The path is the asset id, not the member's, and it resolves through an endpoint that asks whether
 * the photo is still attached and its owner is visible on every request — there is no bucket URL to hand out and nothing here
 * that survives a withdrawal. No cache-busting parameter is needed: replacing a photo mints a new
 * asset id, so a changed photo is a changed URL, and the endpoint's ETag settles the rest.
 */
export const profilePhotoUrl = (
  assetId: string,
  variant: PhotoVariant,
): string => `/media/profile/${assetId}/${variant}`;
