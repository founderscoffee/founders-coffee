import { cookieName, LOCALES, type Locale } from '@founders-coffee/i18n';

import { withLocale } from '../../lib/locale-routing';

const LOCALE_LABELS: Record<Locale, string> = {
  ar: 'عربية',
  fr: 'FR',
  en: 'EN',
};

type LocaleToggleProps = { locale: Locale };

export const LocaleToggle = ({ locale }: LocaleToggleProps) => {
  const change = (next: Locale) => {
    document.cookie = `${cookieName}=${next}; path=/; max-age=31536000; samesite=lax`;
    const { pathname, search, hash } = window.location;
    const target = withLocale(pathname, next);
    if (target === pathname) window.location.reload();
    else window.location.assign(`${target}${search}${hash}`);
  };
  return (
    <div role="group" aria-label="Language" className="flex gap-1.5">
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={option === locale}
          onClick={() => change(option)}
          className={`h-7 rounded-full px-3 text-label font-medium transition-colors ${
            option === locale
              ? 'bg-base-100 text-base-content'
              : 'text-neutral hover:text-base-content'
          }`}
        >
          {LOCALE_LABELS[option]}
        </button>
      ))}
    </div>
  );
};
