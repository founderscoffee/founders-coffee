import { Link } from '@tanstack/react-router';

import { host_repeat_link, type Locale } from '@founders-coffee/i18n';
import { localizedHostCreate } from '../../lib/locale-routing';

export const RepeatHostLink = ({
  locale,
  marketSlug,
  cityCode,
  eventId,
}: {
  locale: Locale;
  marketSlug: string;
  cityCode: string;
  eventId: string;
}) => (
  <Link
    {...localizedHostCreate(locale, marketSlug)}
    search={{ city: cityCode, repeat: eventId }}
    className="btn btn-outline btn-sm w-fit"
  >
    {host_repeat_link({}, { locale })}
  </Link>
);
