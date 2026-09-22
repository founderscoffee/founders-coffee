import { LOCALES, type Locale } from '@founders-coffee/i18n';

import { useUpdateAccountLocale } from '../../features/account/hooks';
import { applyLocaleChoice } from '../../features/preferences/locale-choice';
import { useAuth } from '../../lib/app-providers';
import { withLocale } from '../../lib/locale-routing';

const LOCALE_LABELS: Record<Locale, string> = {
  ar: 'عربية',
  fr: 'FR',
  en: 'EN',
};

type LocaleToggleProps = { locale: Locale };

export const LocaleToggle = ({ locale }: LocaleToggleProps) => {
  const { isAuthenticated } = useAuth();
  const updateLocale = useUpdateAccountLocale();

  const change = (next: Locale) =>
    applyLocaleChoice(next, {
      persist: isAuthenticated ? updateLocale.mutateAsync : undefined,
      navigate: () => {
        const { pathname, search, hash } = window.location;
        const target = withLocale(pathname, next);
        if (target === pathname) window.location.reload();
        else window.location.assign(`${target}${search}${hash}`);
      },
    });

  return (
    <div role="group" aria-label="Language" className="flex gap-1.5">
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={option === locale}
          onClick={() => void change(option)}
          className={`tap-target h-7 rounded-full px-3 text-label font-medium transition-colors ${
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
