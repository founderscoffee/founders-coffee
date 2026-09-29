/**
 * The fields a new account is created with, less any picture a Google or GitHub sign-up brings
 * (#110).
 *
 * The provider sends the address of the member's picture there. Nothing shows it, since the photo
 * on a profile is one the member uploads, so the address is not kept.
 */
export const withoutProviderPicture = <Fields extends object>(
  fields: Fields,
) => ({ ...fields, image: null });

/**
 * Store no token Google or GitHub issues with a sign-in (#110).
 *
 * The sign-in reads the tokens while it runs, and nothing calls either provider after it, so a
 * stored token would only be a live key to the member's account there; Google's ID token carries
 * the picture's address too. It runs before every write to an account row, so the refresh a later
 * sign-in makes stores none either.
 */
export const forgetProviderTokens = async () => ({
  data: {
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
  },
});
