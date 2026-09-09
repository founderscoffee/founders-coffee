import { profile } from '@founders-coffee/domain';

export const validateProfileName = (value: string) =>
  profile.displayNameSchema.safeParse(value);
export const hasProfileName = (
  user: { name: string; email?: string | null } | null,
): boolean =>
  !!user && profile.safeProfileDisplayName(user.name, user.email).length > 0;
