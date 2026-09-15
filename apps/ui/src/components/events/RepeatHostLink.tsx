import { Link } from '@tanstack/react-router';

import { host_repeat_link, type Locale } from '@founders-coffee/i18n';

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
    to="/$market/host/create"
    params={{ market: marketSlug }}
    search={{ city: cityCode, repeat: eventId }}
    className="btn btn-outline btn-sm w-fit"
  >
    {host_repeat_link({}, { locale })}
  </Link>
);
