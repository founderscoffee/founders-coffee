import { profile_optional_chip, type Locale } from '@founders-coffee/i18n';

export const OptionalChip = ({ locale }: { locale: Locale }) => (
  <span className="rounded-full bg-base-200 px-2 py-0.5 text-caption text-neutral">
    {profile_optional_chip({}, { locale })}
  </span>
);
