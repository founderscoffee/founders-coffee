import {
  LOCALES,
  account_language_error,
  account_language_note,
  account_language_reset,
  account_language_save,
  account_language_saved,
  saving,
  account_language_title,
  type Locale,
} from '@founders-coffee/i18n';
import { Button, Select, StatusMessage } from '@founders-coffee/ui';

const LOCALE_LABELS: Record<Locale, string> = {
  ar: 'عربية',
  fr: 'Français',
  en: 'English',
};

export const LanguageGroup = ({
  locale,
  value,
  isDirty,
  isPending,
  isError,
  isSuccess,
  onChange,
  onReset,
  onSave,
}: {
  locale: Locale;
  value: Locale;
  isDirty: boolean;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  onChange: (next: Locale) => void;
  onReset: () => void;
  onSave: () => void;
}) => (
  <section className="rounded-box border border-base-300 bg-base-100 p-5 md:p-6">
    <h2 className="font-display text-h4">
      {account_language_title({}, { locale })}
    </h2>
    <p className="mt-1 text-body-sm text-neutral">
      {account_language_note({}, { locale })}
    </p>
    <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
      <label className="min-w-48 flex-1" htmlFor="account-language">
        <span className="sr-only">
          {account_language_title({}, { locale })}
        </span>
        <Select
          id="account-language"
          value={value}
          onChange={(event) => onChange(event.target.value as Locale)}
        >
          {LOCALES.map((option) => (
            <option key={option} value={option}>
              {LOCALE_LABELS[option]}
            </option>
          ))}
        </Select>
      </label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!isDirty || isPending}
          onClick={onReset}
        >
          {account_language_reset({}, { locale })}
        </Button>
        <Button type="button" disabled={!isDirty || isPending} onClick={onSave}>
          {isPending
            ? saving({}, { locale })
            : account_language_save({}, { locale })}
        </Button>
      </div>
    </div>
    <StatusMessage variant="error" className="mt-3">
      {isError ? account_language_error({}, { locale }) : null}
    </StatusMessage>
    <StatusMessage variant="success" className="mt-3">
      {!isError && isSuccess && !isDirty
        ? account_language_saved({}, { locale })
        : null}
    </StatusMessage>
  </section>
);
