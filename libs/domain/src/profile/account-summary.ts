import { z } from 'zod';

import { profileIdentitySchema } from './schemas.js';

export const ACCOUNT_PROVIDERS = [
  'google',
  'github',
  'email',
  'phone',
] as const;

export const accountProviderSchema = z.enum(ACCOUNT_PROVIDERS);
export type AccountProvider = (typeof ACCOUNT_PROVIDERS)[number];

export const accountSummarySchema = z.strictObject({
  userId: profileIdentitySchema,
  email: z.strictObject({
    masked: z.string().min(1),
    verified: z.boolean(),
  }),
  phone: z.strictObject({
    masked: z.string().nullable(),
    verified: z.boolean(),
  }),
  providers: z.array(accountProviderSchema),
  sessionCount: z.number().int().nonnegative(),
});

export type AccountSummary = z.infer<typeof accountSummarySchema>;

const KEEP_LOCAL = 2;
const KEEP_DIGITS = 2;

/**
 * Show enough of an address to recognise it and not enough to read it out.
 *
 * The member already knows their own email; what this protects is the screen it appears on. An
 * account page is the thing people have open when they hand a laptop over or share a call, and a
 * full address sitting on it is the one identifier an onlooker can act on later. Two leading
 * characters are enough to answer "is this the right account?", which is the only question the row
 * is asked.
 *
 * The domain is kept whole on purpose: it is not the secret, and hiding it would leave the row
 * unable to say which of two accounts a member is looking at. The number of dots is fixed rather
 * than proportional, so the mask does not quietly disclose how long the address is.
 */
export const maskEmail = (email: string): string => {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '•'.repeat(Math.max(email.length, 1));
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= KEEP_LOCAL) return `${local[0] ?? ''}•••${domain}`;
  return `${local.slice(0, KEEP_LOCAL)}•••${domain}`;
};

/**
 * Show the last digits of a number, and the country it starts with.
 *
 * The same reasoning as the address above, with one difference: the leading digits of a phone
 * number are a country code shared by millions, so keeping them tells an onlooker nothing while
 * telling the member which number is on file. `null` is not "hidden" — it means no number exists,
 * and the row says so in words rather than in dots.
 */
export const maskPhoneNumber = (phoneNumber: string | null): string | null => {
  if (!phoneNumber) return null;
  const digits = phoneNumber.replace(/[^\d]/g, '');
  if (digits.length <= KEEP_DIGITS) return '•'.repeat(4);
  const prefix = phoneNumber.startsWith('+') ? `+${digits.slice(0, 3)}` : '';
  return `${prefix} •••• ${digits.slice(-KEEP_DIGITS)}`.trim();
};

/** Keep only the providers this product knows, so an unexpected id cannot reach the screen. */
export const knownAccountProviders = (
  providerIds: readonly string[],
): AccountProvider[] => {
  const known = new Set<AccountProvider>();
  for (const id of providerIds) {
    const match = ACCOUNT_PROVIDERS.find((provider) => provider === id);
    if (match) known.add(match);
  }
  return [...known];
};
