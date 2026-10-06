import { event_map_improve, type Locale } from '@founders-coffee/i18n';

import { MAP_FEEDBACK_URL, STATIC_MAP_CREDITS } from '../../lib/static-map';

type StaticMapCreditsProps = {
  locale: Locale;
};

const LINK =
  'inline-flex min-h-6 items-center underline-offset-2 hover:text-primary hover:underline focus-visible:underline';

export const StaticMapCredits = ({ locale }: StaticMapCreditsProps) => (
  <p className="mt-1 flex flex-wrap gap-x-3 text-caption text-neutral">
    {STATIC_MAP_CREDITS.map(({ label, href }) => (
      <a
        key={href}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        dir="ltr"
        className={LINK}
      >
        {label}
      </a>
    ))}
    <a
      href={MAP_FEEDBACK_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`${LINK} font-semibold`}
    >
      {event_map_improve({}, { locale })}
    </a>
  </p>
);
