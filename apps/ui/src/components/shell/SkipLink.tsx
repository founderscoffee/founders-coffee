import { skip_to_content, type Locale } from '@founders-coffee/i18n';

type SkipLinkProps = { locale: Locale };

const skipLinkClass =
  'fixed -top-16 start-3 z-[60] rounded-field border border-base-300 bg-base-100 px-4 py-2 text-body font-semibold text-base-content shadow-lg transition-[top] focus:top-3';

export const SkipLink = ({ locale }: SkipLinkProps) => (
  <a href="#main-content" className={skipLinkClass}>
    {skip_to_content({}, { locale })}
  </a>
);
