import { cookieName, LOCALES, type Locale } from '@founders-coffee/i18n'

type LocaleToggleProps = { locale: Locale }

export const LocaleToggle = ({ locale }: LocaleToggleProps) => {
  const change = (l: Locale) => {
    document.cookie = `${cookieName}=${l}; path=/; max-age=31536000; samesite=lax`
    window.location.reload()
  }
  return (
    <div className="flex gap-1 rounded-field border border-base-300 bg-base-100 p-1">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => change(l)}
          className={`rounded-[calc(var(--radius-field)-0.25rem)] px-2 py-1 text-xs font-bold ${l === locale ? 'bg-neutral text-neutral-content' : 'text-base-content/40'}`}
        >
          {l === 'ar' ? 'ع' : l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
