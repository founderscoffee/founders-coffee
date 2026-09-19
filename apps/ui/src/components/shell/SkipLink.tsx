import { skip_to_content, type Locale } from '@founders-coffee/i18n';

type SkipLinkProps = { locale: Locale };

const skipLinkClass =
  'sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-[60] focus:rounded-field focus:border focus:border-base-300 focus:bg-base-100 focus:px-4 focus:py-2 focus:text-body focus:font-semibold focus:text-base-content focus:shadow-lg';

export const SkipLink = ({ locale }: SkipLinkProps) => (
  <a href="#main-content" className={skipLinkClass}>
    {skip_to_content({}, { locale })}
  </a>
);
