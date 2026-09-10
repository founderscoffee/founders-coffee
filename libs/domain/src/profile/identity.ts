import { displayNameSchema } from './schemas.js';

/**
 * Return only a usable authored name, never a contact-derived identity fallback.
 *
 * The comparison is against the email alone. A phone number was compared too, which defended
 * against Better Auth's phone-number plugin creating a user whose `name` is the number verbatim —
 * it does exactly that when `signUpOnVerification` is configured without a `getTempName`. That
 * option is not configured here and no phone-login surface exists, so the guard was protecting a
 * path that is switched off, while costing the one thing that matters more: the client cannot see a
 * phone number on the session, so it could not apply the same rule, and the two sides disagreed
 * about whether a member had a usable name.
 *
 * **If `signUpOnVerification` is ever enabled, it must supply `getTempName`.** Without it the
 * plugin writes the phone number into `name` and this function will hand it to a public profile.
 */
export const safeProfileDisplayName = (
  name: string,
  email?: string | null,
): string => {
  const parsed = displayNameSchema.safeParse(name);
  if (!parsed.success) return '';
  const value = parsed.data;
  return value.toLowerCase() === email?.trim().toLowerCase() ? '' : value;
};
