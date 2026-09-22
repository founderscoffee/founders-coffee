import {
  host_language_hint,
  host_language_label,
  LOCALES,
  type Locale,
} from '@founders-coffee/i18n';

import { localeLabel } from '../../features/profile/profile-labels';

export const EventLanguageField = ({
  id,
  locale,
  value,
  onChange,
}: {
  id: string;
  locale: Locale;
  value: Locale;
  onChange: (next: Locale) => void;
}) => (
  <div className="form-control">
    <label htmlFor={id} className="mb-1 block text-body-sm text-neutral">
      {host_language_label({}, { locale })}
    </label>
    <select
      id={id}
      className="select select-bordered w-full"
      value={value}
      onChange={(event) => onChange(event.target.value as Locale)}
      aria-describedby={`${id}-hint`}
    >
      {LOCALES.map((option) => (
        <option key={option} value={option}>
          {localeLabel(option, locale)}
        </option>
      ))}
    </select>
    <span id={`${id}-hint`} className="mt-1 text-caption text-neutral">
      {host_language_hint({}, { locale })}
    </span>
  </div>
);
