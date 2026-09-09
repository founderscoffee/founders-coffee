import { displayNameSchema } from './schemas.js';

/** Return only a usable authored name, never a contact-derived identity fallback. */
export const safeProfileDisplayName = (
  name: string,
  email?: string | null,
  phone?: string | null,
): string => {
  const parsed = displayNameSchema.safeParse(name);
  if (!parsed.success) return '';
  const value = parsed.data;
  if (
    value.toLowerCase() === email?.trim().toLowerCase() ||
    value === phone?.trim()
  )
    return '';
  return value;
};
