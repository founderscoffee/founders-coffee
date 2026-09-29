export const SOCIAL_PROVIDERS = ['google', 'github'] as const;

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

type SocialEnv = Partial<
  Record<`${Uppercase<SocialProvider>}_CLIENT_${'ID' | 'SECRET'}`, string>
>;

/** A provider's OAuth client, or `null` unless both its ID and its secret are set. */
export const socialCredentials = (
  env: SocialEnv,
  provider: SocialProvider,
): { readonly clientId: string; readonly clientSecret: string } | null => {
  const prefix = provider.toUpperCase() as Uppercase<SocialProvider>;
  const clientId = env[`${prefix}_CLIENT_ID`];
  const clientSecret = env[`${prefix}_CLIENT_SECRET`];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
};

/**
 * The OAuth providers a sign-in screen may offer: the ones this deployment holds both halves of.
 *
 * One yes-or-no used to stand for all of them, so with Google set up and GitHub not, both buttons
 * showed and GitHub's failed when pressed (#112). `createAuth` configures a provider by the same
 * test, so a screen offers exactly the providers the server will accept.
 */
export const configuredSocialProviders = (env: SocialEnv): SocialProvider[] =>
  SOCIAL_PROVIDERS.filter(
    (provider) => socialCredentials(env, provider) !== null,
  );
