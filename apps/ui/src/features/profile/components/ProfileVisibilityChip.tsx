import { profile_public_chip, type Locale } from '@founders-coffee/i18n';

export const ProfileVisibilityChip = ({ locale }: { locale: Locale }) => (
  <span className="rounded-full bg-base-200 px-2 py-0.5 text-caption text-neutral">
    {profile_public_chip({}, { locale })}
  </span>
);
