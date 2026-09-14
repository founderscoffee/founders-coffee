import { LOCALES, cookieName, type Locale } from '@founders-coffee/i18n';

const LABELS: Record<Locale, string> = {
  ar: 'عربية',
  fr: 'FR',
  en: 'EN',
};

export const LocaleToggle = ({ active }: { active: Locale }) => {
  const choose = (next: Locale) => {
    document.cookie = `${cookieName}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };

  return (
    <div className="flex gap-1.5" role="group" aria-label="Language">
      {LOCALES.map((locale) => (
        <button
          aria-current={locale === active ? 'true' : undefined}
          className={
            locale === active
              ? 'btn btn-xs btn-primary'
              : 'btn btn-xs btn-ghost'
          }
          key={locale}
          onClick={() => choose(locale)}
          type="button"
        >
          {LABELS[locale]}
        </button>
      ))}
    </div>
  );
};
