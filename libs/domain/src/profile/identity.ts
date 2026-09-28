import { displayNameSchema } from './schemas.js';

const NAME_LENGTH = 80;
const NOT_A_NAME = /[^\p{L}\p{M}']+/u;

/**
 * Return a usable name, never the email address itself.
 *
 * A name derived from the email's local part at sign-up (`displayNameFromEmail`) is a real name
 * here, as one the member typed is (#119): only the whole address is refused, which is what
 * Better Auth would otherwise leave in `name` for a sign-up that brought none.
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

const capitalize = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

/**
 * The display name a member starts with when their sign-up brought none: their email's local part,
 * read as words (#119).
 *
 * A `+tag` is dropped, and dots, underscores, hyphens, digits and any other character that is not a
 * letter separate words, so `sara.benali+work@example.com` becomes "Sara Benali". An apostrophe
 * inside a word stays, as in O'Brien. Each word is capitalised and the name stops at 80 characters,
 * the limit a typed name has. A local part with no letters, such as `0555123456`, gives `''`: digits
 * alone are more often a phone number than a name.
 */
export const displayNameFromEmail = (email: string): string => {
  const localPart = email.trim().split('@')[0];
  const [untagged] = localPart.split('+');
  const words = untagged
    .split(NOT_A_NAME)
    .map((word) => word.replace(/^'+|'+$/gu, ''))
    .filter(Boolean)
    .map(capitalize);
  return Array.from(words.join(' ')).slice(0, NAME_LENGTH).join('').trim();
};

/**
 * The display name an account starts with: the name its sign-up brought when that is usable, as
 * Google's and GitHub's usually are, or else the one its email reads as (#119). `''` when neither
 * gives one.
 */
export const startingDisplayName = (name: string, email: string): string =>
  safeProfileDisplayName(name, email) || displayNameFromEmail(email);
